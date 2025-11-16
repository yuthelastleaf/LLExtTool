cmake_minimum_required(VERSION 3.15)
project(LLExtTool_Native)

# 设置 C++ 标准
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 设置输出目录
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

# 包含 cmake-js (提供 CMAKE_JS_INC 等变量)
include_directories(${CMAKE_JS_INC})

# 包含 node-addon-api
execute_process(
    COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
string(REPLACE "\\" "/" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})

# 打印信息
message(STATUS "Node-API include directory: ${NODE_ADDON_API_DIR}")
message(STATUS "CMake.js include directories: ${CMAKE_JS_INC}")

# FFmpeg 路径
set(FFMPEG_ROOT "${CMAKE_SOURCE_DIR}/native/ffmpeg")
set(FFMPEG_INCLUDE_DIR "${FFMPEG_ROOT}/include")
set(FFMPEG_LIB_DIR "${FFMPEG_ROOT}/lib")

# Whisper.cpp 路径
set(WHISPER_ROOT "${CMAKE_SOURCE_DIR}/native/whisper.cpp")
set(WHISPER_INCLUDE_DIR "${WHISPER_ROOT}")
set(WHISPER_BUILD_DIR "${WHISPER_ROOT}/build")

# ============================================================================
# LLVideo 模块 (FFmpeg 封装)
# ============================================================================
add_library(llvideo SHARED
    native/src/llvideo.cpp
    native/src/ffmpeg_wrapper.cpp
)

target_include_directories(llvideo PRIVATE
    ${NODE_ADDON_API_DIR}
    native/include
    ${FFMPEG_INCLUDE_DIR}
)

target_link_directories(llvideo PRIVATE
    ${FFMPEG_LIB_DIR}
)

target_link_libraries(llvideo PRIVATE
    ${CMAKE_JS_LIB}
    avcodec
    avformat
    avutil
    swresample
)

# 设置输出文件名为 .node
set_target_properties(llvideo PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    OUTPUT_NAME "llvideo"
)

# Windows 特定设置
if(WIN32)
    target_compile_definitions(llvideo PRIVATE
        WIN32_LEAN_AND_MEAN
        NAPI_VERSION=8
        NAPI_DISABLE_CPP_EXCEPTIONS
    )
    
    # 复制 FFmpeg DLL 到输出目录
    file(GLOB FFMPEG_DLLS "${FFMPEG_ROOT}/bin/*.dll")
    add_custom_command(TARGET llvideo POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            ${FFMPEG_DLLS}
            $<TARGET_FILE_DIR:llvideo>
        COMMENT "Copying FFmpeg DLLs to output directory"
    )
endif()

# ============================================================================
# LLWhisper 模块 (Whisper.cpp 封装)
# ============================================================================
add_library(llwhisper SHARED
    native/src/llwhisper.cpp
    native/src/whisper_wrapper.cpp
)

target_include_directories(llwhisper PRIVATE
    ${NODE_ADDON_API_DIR}
    native/include
    ${WHISPER_INCLUDE_DIR}/include
    ${WHISPER_INCLUDE_DIR}/ggml/include
    ${WHISPER_INCLUDE_DIR}/build/_deps/ggml-src/include
    ${FFMPEG_INCLUDE_DIR}
)

target_link_directories(llwhisper PRIVATE
    ${FFMPEG_LIB_DIR}
    ${WHISPER_BUILD_DIR}/src/Release
    ${WHISPER_BUILD_DIR}/ggml/src/Release
)

# 链接 Node.js 库和 FFmpeg
target_link_libraries(llwhisper PRIVATE 
    ${CMAKE_JS_LIB}
    avcodec
    avformat
    avutil
    swresample
)

# 查找 Whisper 库
find_library(WHISPER_LIB
    NAMES whisper
    PATHS "${WHISPER_BUILD_DIR}/src/Release"
          "${WHISPER_BUILD_DIR}/bin/Release"
    NO_DEFAULT_PATH
)

# 查找 GGML 库
find_library(GGML_LIB
    NAMES ggml
    PATHS "${WHISPER_BUILD_DIR}/ggml/src/Release"
          "${WHISPER_BUILD_DIR}/bin/Release"
    NO_DEFAULT_PATH
)

if(WHISPER_LIB AND GGML_LIB)
    message(STATUS "Found Whisper library: ${WHISPER_LIB}")
    message(STATUS "Found GGML library: ${GGML_LIB}")
    target_link_libraries(llwhisper PRIVATE ${WHISPER_LIB} ${GGML_LIB})
else()
    message(WARNING "Whisper or GGML library not found. Please build whisper.cpp first.")
    if(NOT WHISPER_LIB)
        message(WARNING "  Whisper library not found")
    endif()
    if(NOT GGML_LIB)
        message(WARNING "  GGML library not found")
    endif()
endif()

# 设置输出文件名为 .node
set_target_properties(llwhisper PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    OUTPUT_NAME "llwhisper"
)

# Windows 特定设置
if(WIN32)
    target_compile_definitions(llwhisper PRIVATE
        WIN32_LEAN_AND_MEAN
        NAPI_VERSION=8
        NAPI_DISABLE_CPP_EXCEPTIONS
    )
    
    # 复制 Whisper DLL 和 GGML DLL 到输出目录
    file(GLOB WHISPER_DLLS "${WHISPER_BUILD_DIR}/bin/Release/*.dll")
    if(WHISPER_DLLS)
        add_custom_command(TARGET llwhisper POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
                ${WHISPER_DLLS}
                $<TARGET_FILE_DIR:llwhisper>
            COMMENT "Copying Whisper and GGML DLLs to output directory"
        )
    endif()
endif()

# ============================================================================
# 安装规则
# ============================================================================
# 将 .node 文件安装到 build/Release 目录（与 node-gyp 兼容）
install(TARGETS llvideo llwhisper
    LIBRARY DESTINATION ${CMAKE_SOURCE_DIR}/build/Release
    RUNTIME DESTINATION ${CMAKE_SOURCE_DIR}/build/Release
)

# 复制 DLL 文件
if(WIN32)
    file(GLOB FFMPEG_DLLS_INSTALL "${FFMPEG_ROOT}/bin/*.dll")
    install(FILES ${FFMPEG_DLLS_INSTALL}
        DESTINATION ${CMAKE_SOURCE_DIR}/build/Release
        OPTIONAL
    )
    
    file(GLOB WHISPER_DLLS_INSTALL "${WHISPER_BUILD_DIR}/bin/Release/*.dll")
    if(WHISPER_DLLS_INSTALL)
        install(FILES ${WHISPER_DLLS_INSTALL}
            DESTINATION ${CMAKE_SOURCE_DIR}/build/Release
        )
    endif()
endif()

# ============================================================================
# 打印配置信息
# ============================================================================
message(STATUS "=================================================")
message(STATUS "LLExtTool Native Modules Configuration")
message(STATUS "=================================================")
message(STATUS "C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "FFmpeg Root: ${FFMPEG_ROOT}")
message(STATUS "Whisper Root: ${WHISPER_ROOT}")
message(STATUS "Output Directory: ${CMAKE_SOURCE_DIR}/build/Release")
message(STATUS "=================================================")
