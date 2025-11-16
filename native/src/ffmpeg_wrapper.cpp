#include "../include/ffmpeg_wrapper.h"
#include <iostream>
#include <cstring>
#include <filesystem>

extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libavutil/avutil.h>
#include <libavutil/opt.h>
#include <libswresample/swresample.h>
}

namespace fs = std::filesystem;

namespace llvideo {

FFmpegWrapper::FFmpegWrapper() {
    init();
}

FFmpegWrapper::~FFmpegWrapper() {
    cleanup();
}

void FFmpegWrapper::init() {
    // FFmpeg 4.0+ 不需要 av_register_all()
}

void FFmpegWrapper::cleanup() {
    // 清理资源
}

void FFmpegWrapper::setError(const std::string& error) {
    lastError = error;
    std::cerr << "[FFmpeg Error] " << error << std::endl;
}

std::string FFmpegWrapper::getLastError() const {
    return lastError;
}

bool FFmpegWrapper::isValidMediaFile(const std::string& inputPath) {
    if (!fs::exists(inputPath)) {
        setError("File does not exist: " + inputPath);
        return false;
    }

    AVFormatContext* formatCtx = nullptr;
    int ret = avformat_open_input(&formatCtx, inputPath.c_str(), nullptr, nullptr);
    
    if (ret < 0) {
        char errBuf[AV_ERROR_MAX_STRING_SIZE];
        av_strerror(ret, errBuf, sizeof(errBuf));
        setError(std::string("Cannot open file: ") + errBuf);
        return false;
    }

    avformat_close_input(&formatCtx);
    return true;
}

VideoInfo FFmpegWrapper::getVideoInfo(const std::string& inputPath) {
    VideoInfo info;
    AVFormatContext* formatCtx = nullptr;
    
    int ret = avformat_open_input(&formatCtx, inputPath.c_str(), nullptr, nullptr);
    if (ret < 0) {
        char errBuf[AV_ERROR_MAX_STRING_SIZE];
        av_strerror(ret, errBuf, sizeof(errBuf));
        setError(std::string("Cannot open input file: ") + errBuf);
        return info;
    }

    ret = avformat_find_stream_info(formatCtx, nullptr);
    if (ret < 0) {
        setError("Cannot find stream information");
        avformat_close_input(&formatCtx);
        return info;
    }

    info.format = formatCtx->iformat->name;
    info.duration = formatCtx->duration / (double)AV_TIME_BASE;
    info.bitrate = formatCtx->bit_rate;

    for (unsigned int i = 0; i < formatCtx->nb_streams; i++) {
        AVStream* stream = formatCtx->streams[i];
        AVCodecParameters* codecpar = stream->codecpar;

        if (codecpar->codec_type == AVMEDIA_TYPE_VIDEO && !info.hasVideo) {
            info.hasVideo = true;
            info.width = codecpar->width;
            info.height = codecpar->height;
            
            AVRational frameRate = av_guess_frame_rate(formatCtx, stream, nullptr);
            if (frameRate.num && frameRate.den) {
                info.fps = av_q2d(frameRate);
            }
            
            const AVCodec* codec = avcodec_find_decoder(codecpar->codec_id);
            if (codec) {
                info.videoCodec = codec->name;
            }
        }
        else if (codecpar->codec_type == AVMEDIA_TYPE_AUDIO && !info.hasAudio) {
            info.hasAudio = true;
            info.audioSampleRate = codecpar->sample_rate;
            info.audioChannels = codecpar->ch_layout.nb_channels;
            
            const AVCodec* codec = avcodec_find_decoder(codecpar->codec_id);
            if (codec) {
                info.audioCodec = codec->name;
            }
        }
    }

    avformat_close_input(&formatCtx);
    return info;
}

bool FFmpegWrapper::extractAudio(const std::string& inputPath,
                                 const std::string& outputPath,
                                 const AudioExtractionOptions& options,
                                 ProgressCallback callback) {
    AVFormatContext* inputFormatCtx = nullptr;
    AVFormatContext* outputFormatCtx = nullptr;
    AVCodecContext* decoderCtx = nullptr;
    AVCodecContext* encoderCtx = nullptr;
    SwrContext* swrCtx = nullptr;
    
    int ret;
    int audioStreamIndex = -1;
    bool success = false;

    // 打开输入文件
    ret = avformat_open_input(&inputFormatCtx, inputPath.c_str(), nullptr, nullptr);
    if (ret < 0) {
        char errBuf[AV_ERROR_MAX_STRING_SIZE];
        av_strerror(ret, errBuf, sizeof(errBuf));
        setError(std::string("Cannot open input: ") + errBuf);
        goto cleanup;
    }

    ret = avformat_find_stream_info(inputFormatCtx, nullptr);
    if (ret < 0) {
        setError("Cannot find stream info");
        goto cleanup;
    }

    // 查找音频流
    for (unsigned int i = 0; i < inputFormatCtx->nb_streams; i++) {
        if (inputFormatCtx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_AUDIO) {
            audioStreamIndex = i;
            break;
        }
    }

    if (audioStreamIndex == -1) {
        setError("No audio stream found");
        goto cleanup;
    }

    {
        AVStream* audioStream = inputFormatCtx->streams[audioStreamIndex];
        AVCodecParameters* codecpar = audioStream->codecpar;

        // 打开解码器
        const AVCodec* decoder = avcodec_find_decoder(codecpar->codec_id);
        if (!decoder) {
            setError("Cannot find decoder");
            goto cleanup;
        }

        decoderCtx = avcodec_alloc_context3(decoder);
        avcodec_parameters_to_context(decoderCtx, codecpar);
        
        ret = avcodec_open2(decoderCtx, decoder, nullptr);
        if (ret < 0) {
            setError("Cannot open decoder");
            goto cleanup;
        }

        // 创建输出
        avformat_alloc_output_context2(&outputFormatCtx, nullptr, 
                                       options.format.c_str(), outputPath.c_str());
        if (!outputFormatCtx) {
            setError("Cannot create output context");
            goto cleanup;
        }

        // 查找编码器
        const AVCodec* encoder = avcodec_find_encoder_by_name(options.codec.c_str());
        if (!encoder) {
            setError("Cannot find encoder: " + options.codec);
            goto cleanup;
        }

        AVStream* outStream = avformat_new_stream(outputFormatCtx, nullptr);
        encoderCtx = avcodec_alloc_context3(encoder);
        
        encoderCtx->sample_rate = options.sampleRate;
        encoderCtx->ch_layout.nb_channels = options.channels;
        if (options.channels == 1) {
            encoderCtx->ch_layout = AV_CHANNEL_LAYOUT_MONO;
        } else {
            encoderCtx->ch_layout = AV_CHANNEL_LAYOUT_STEREO;
        }
        encoderCtx->sample_fmt = encoder->sample_fmts[0];
        
        if (outputFormatCtx->oformat->flags & AVFMT_GLOBALHEADER) {
            encoderCtx->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
        }

        ret = avcodec_open2(encoderCtx, encoder, nullptr);
        if (ret < 0) {
            char errBuf[AV_ERROR_MAX_STRING_SIZE];
            av_strerror(ret, errBuf, sizeof(errBuf));
            setError(std::string("Cannot open encoder: ") + errBuf);
            goto cleanup;
        }

        avcodec_parameters_from_context(outStream->codecpar, encoderCtx);
        outStream->time_base = encoderCtx->time_base;

        // 创建重采样器
        swr_alloc_set_opts2(&swrCtx,
                           &encoderCtx->ch_layout,
                           encoderCtx->sample_fmt,
                           encoderCtx->sample_rate,
                           &decoderCtx->ch_layout,
                           decoderCtx->sample_fmt,
                           decoderCtx->sample_rate,
                           0, nullptr);
        swr_init(swrCtx);

        // 打开输出文件
        if (!(outputFormatCtx->oformat->flags & AVFMT_NOFILE)) {
            ret = avio_open(&outputFormatCtx->pb, outputPath.c_str(), AVIO_FLAG_WRITE);
            if (ret < 0) {
                setError("Cannot open output file");
                goto cleanup;
            }
        }

        avformat_write_header(outputFormatCtx, nullptr);

        // 处理音频帧
        AVPacket* packet = av_packet_alloc();
        AVFrame* frame = av_frame_alloc();
        AVFrame* outFrame = av_frame_alloc();

        outFrame->format = encoderCtx->sample_fmt;
        outFrame->ch_layout = encoderCtx->ch_layout;
        outFrame->sample_rate = encoderCtx->sample_rate;
        outFrame->nb_samples = encoderCtx->frame_size > 0 ? encoderCtx->frame_size : 1024;
        av_frame_get_buffer(outFrame, 0);

        double totalDuration = inputFormatCtx->duration / (double)AV_TIME_BASE;

        while (av_read_frame(inputFormatCtx, packet) >= 0) {
            if (packet->stream_index == audioStreamIndex) {
                ret = avcodec_send_packet(decoderCtx, packet);
                
                while (ret >= 0) {
                    ret = avcodec_receive_frame(decoderCtx, frame);
                    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) break;
                    if (ret < 0) break;

                    // 重采样
                    swr_convert_frame(swrCtx, outFrame, frame);

                    // 编码
                    avcodec_send_frame(encoderCtx, outFrame);
                    AVPacket* outPkt = av_packet_alloc();
                    while (avcodec_receive_packet(encoderCtx, outPkt) >= 0) {
                        outPkt->stream_index = 0;
                        av_packet_rescale_ts(outPkt, encoderCtx->time_base, outStream->time_base);
                        av_interleaved_write_frame(outputFormatCtx, outPkt);
                        av_packet_unref(outPkt);
                    }
                    av_packet_free(&outPkt);

                    // 进度回调
                    if (callback && totalDuration > 0) {
                        double current = frame->pts * av_q2d(audioStream->time_base);
                        callback((current / totalDuration) * 100.0);
                    }

                    av_frame_unref(frame);
                }
            }
            av_packet_unref(packet);
        }

        // 刷新编码器
        avcodec_send_frame(encoderCtx, nullptr);
        AVPacket* outPkt = av_packet_alloc();
        while (avcodec_receive_packet(encoderCtx, outPkt) >= 0) {
            outPkt->stream_index = 0;
            av_packet_rescale_ts(outPkt, encoderCtx->time_base, outStream->time_base);
            av_interleaved_write_frame(outputFormatCtx, outPkt);
            av_packet_unref(outPkt);
        }
        av_packet_free(&outPkt);

        av_write_trailer(outputFormatCtx);

        av_frame_free(&frame);
        av_frame_free(&outFrame);
        av_packet_free(&packet);

        if (callback) callback(100.0);
        success = true;
    }

cleanup:
    if (decoderCtx) avcodec_free_context(&decoderCtx);
    if (encoderCtx) avcodec_free_context(&encoderCtx);
    if (swrCtx) swr_free(&swrCtx);
    if (outputFormatCtx) {
        if (!(outputFormatCtx->oformat->flags & AVFMT_NOFILE)) {
            avio_closep(&outputFormatCtx->pb);
        }
        avformat_free_context(outputFormatCtx);
    }
    if (inputFormatCtx) avformat_close_input(&inputFormatCtx);
    
    return success;
}

} // namespace llvideo
