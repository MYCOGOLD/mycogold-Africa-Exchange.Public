cmake_minimum_required(VERSION 3.20)
project(mycogold_engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(mycogold_market_engine
  src/market_index.cpp
  src/order_book.cpp
)
target_include_directories(mycogold_market_engine PUBLIC include)
target_compile_options(mycogold_market_engine PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wshadow)

add_executable(market_index_tests tests/market_index_test.cpp)
target_link_libraries(market_index_tests PRIVATE mycogold_market_engine)
target_compile_options(market_index_tests PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wshadow)

add_executable(order_book_tests tests/order_book_test.cpp)
target_link_libraries(order_book_tests PRIVATE mycogold_market_engine)
target_compile_options(order_book_tests PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wshadow)

add_executable(order_book_benchmark benchmarks/order_book_benchmark.cpp)
target_link_libraries(order_book_benchmark PRIVATE mycogold_market_engine)
target_compile_options(order_book_benchmark PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wshadow)

enable_testing()
add_test(NAME market_index_tests COMMAND market_index_tests)
add_test(NAME order_book_tests COMMAND order_book_tests)
