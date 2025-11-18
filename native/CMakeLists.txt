cmake_minimum_required(VERSION 3.15)
project(test_ctranslate2)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# CTranslate2 路径
set(CTRANSLATE2_DIR "${CMAKE_CURRENT_SOURCE_DIR}/ctranslate2")

# 添加包含目录
include_directories(${CTRANSLATE2_DIR}/include)

# 添加可执行文件
add_executable(test_ctranslate2 test_ctranslate2.cpp)

# 链接 CTranslate2 库
target_link_directories(test_ctranslate2 PRIVATE ${CTRANSLATE2_DIR}/lib)
target_link_libraries(test_ctranslate2 PRIVATE ctranslate2)

# 复制 DLL 到输出目录
add_custom_command(TARGET test_ctranslate2 POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
    "${CTRANSLATE2_DIR}/bin/ctranslate2.dll"
    $<TARGET_FILE_DIR:test_ctranslate2>
)
