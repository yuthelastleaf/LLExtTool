{
  "targets": [
    {
      "target_name": "llvideo",
      "sources": [
        "native/src/llvideo.cpp",
        "native/src/ffmpeg_wrapper.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "native/include",
        "native/ffmpeg/include"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": [ "/std:c++17" ]
        }
      },
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "../native/ffmpeg/lib/avcodec.lib",
            "../native/ffmpeg/lib/avformat.lib",
            "../native/ffmpeg/lib/avutil.lib",
            "../native/ffmpeg/lib/swresample.lib"
          ],
          "copies": [
            {
              "destination": "<(module_root_dir)/build/Release/",
              "files": [
                "native/ffmpeg/bin/avcodec-61.dll",
                "native/ffmpeg/bin/avformat-61.dll",
                "native/ffmpeg/bin/avutil-59.dll",
                "native/ffmpeg/bin/swresample-5.dll"
              ]
            }
          ]
        }]
      ]
    },
    {
      "target_name": "llwhisper",
      "sources": [
        "native/src/llwhisper.cpp",
        "native/src/whisper_wrapper.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "native/include",
        "native/whisper.cpp/include",
        "native/whisper.cpp/ggml/include",
        "native/whisper.cpp/build/_deps/ggml-src/include",
        "native/ffmpeg/include"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": [ "/std:c++17" ]
        }
      },
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "../native/whisper.cpp/build/src/Release/whisper.lib",
            "../native/ffmpeg/lib/avcodec.lib",
            "../native/ffmpeg/lib/avformat.lib",
            "../native/ffmpeg/lib/avutil.lib",
            "../native/ffmpeg/lib/swresample.lib"
          ],
          "copies": [
            {
              "destination": "<(module_root_dir)/build/Release/",
              "files": [
                "native/whisper.cpp/build/bin/Release/whisper.dll",
                "native/whisper.cpp/build/bin/Release/ggml.dll",
                "native/whisper.cpp/build/bin/Release/ggml-base.dll",
                "native/whisper.cpp/build/bin/Release/ggml-cpu.dll",
                "native/whisper.cpp/build/bin/Release/ggml-cuda.dll"
              ]
            }
          ]
        }]
      ]
    }
  ]
}
