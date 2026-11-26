cmake_minimum_required(VERSION 3.20)
project(mycogold_engine VERSION 1.0.0 LANGUAGES CXX)

option(MYCOGOLD_ENABLE_IPO "Enable interprocedural optimization in Release builds" ON)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

include(CheckIPOSupported)
find_package(OpenSSL REQUIRED COMPONENTS Crypto)
if(MYCOGOLD_ENABLE_IPO)
  check_ipo_supported(RESULT MYCOGOLD_IPO_SUPPORTED OUTPUT MYCOGOLD_IPO_ERROR)
else()
  set(MYCOGOLD_IPO_SUPPORTED FALSE)
endif()

function(mycogold_configure_target target)
  target_compile_options(${target} PRIVATE
    "$<$<CXX_COMPILER_ID:GNU,Clang>:-Wall;-Wextra;-Wpedantic;-Wconversion;-Wshadow>"
    "$<$<CXX_COMPILER_ID:MSVC>:/W4;/permissive->"
  )
  if(MYCOGOLD_IPO_SUPPORTED)
    set_property(TARGET ${target} PROPERTY INTERPROCEDURAL_OPTIMIZATION_RELEASE TRUE)
  endif()
endfunction()

add_library(mycogold_market_engine
  src/market_index.cpp
  src/order_book.cpp
  src/freshness.cpp
  src/c_api.cpp
  src/util.cpp
  src/sha.cpp
  src/script.cpp
  src/net.cpp
  src/db.cpp
  src/worker_discovery.cpp
  src/optimization.cpp
)
target_include_directories(mycogold_market_engine PUBLIC include)
target_link_libraries(mycogold_market_engine PUBLIC OpenSSL::Crypto)
mycogold_configure_target(mycogold_market_engine)

add_executable(market_index_tests tests/market_index_test.cpp)
target_link_libraries(market_index_tests PRIVATE mycogold_market_engine)
mycogold_configure_target(market_index_tests)

add_executable(order_book_tests tests/order_book_test.cpp)
target_link_libraries(order_book_tests PRIVATE mycogold_market_engine)
mycogold_configure_target(order_book_tests)

add_executable(freshness_tests tests/freshness_test.cpp)
target_link_libraries(freshness_tests PRIVATE mycogold_market_engine)
mycogold_configure_target(freshness_tests)

add_executable(c_api_tests tests/c_api_test.cpp)
target_link_libraries(c_api_tests PRIVATE mycogold_market_engine)
mycogold_configure_target(c_api_tests)

add_executable(core_modules_tests tests/core_modules_test.cpp)
target_link_libraries(core_modules_tests PRIVATE mycogold_market_engine)
mycogold_configure_target(core_modules_tests)

add_executable(mycogold-engine src/main.cpp)
target_link_libraries(mycogold-engine PRIVATE mycogold_market_engine)
mycogold_configure_target(mycogold-engine)

add_executable(order_book_benchmark benchmarks/order_book_benchmark.cpp)
target_link_libraries(order_book_benchmark PRIVATE mycogold_market_engine)
mycogold_configure_target(order_book_benchmark)

enable_testing()
add_test(NAME market_index_tests COMMAND market_index_tests)
add_test(NAME order_book_tests COMMAND order_book_tests)
add_test(NAME freshness_tests COMMAND freshness_tests)
add_test(NAME c_api_tests COMMAND c_api_tests)

add_test(NAME core_modules_tests COMMAND core_modules_tests)
add_test(NAME engine_self_check COMMAND mycogold-engine --self-check)
