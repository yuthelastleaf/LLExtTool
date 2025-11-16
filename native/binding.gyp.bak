{
  "targets": [
    {
      "target_name": "llvideo",
      "product_name": "llvideo",
      "sources": [
        "src/llvideo.cpp",
        "src/ffmpeg_wrapper.cpp"
      ],
      "include_dirs": [ "<!@(node -p \"require('node-addon-api').include\")" ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": ["/utf-8"]
        }
      }
    },
    {
      "target_name": "llwhisper",
      "product_name": "llwhisper",
      "sources": [
        "src/llwhisper.cpp",
        "src/whisper_wrapper.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include",
        "whisper.cpp/include",
        "whisper.cpp/ggml/include",
        "ffmpeg/include"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": ["/utf-8"]
        }
      }
    }
  ]
}
