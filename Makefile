ASYNC_TESTS_FAST = $(shell find test/ -name '*.test.coffee')
ASYNC_TESTS_SLOW = $(shell find test/ -name '*.test.slow.coffee')
SERIAL_TESTS_FAST = $(shell find test/ -name '*.test.serial.coffee')
SERIAL_TESTS_SLOW = $(shell find test/ -name '*.test.serial.slow.coffee')

test-async-fast:
	@NODE_ENV=test ./node_modules/expresso/bin/expresso \
		$(TESTFLAGS) \
		$(ASYNC_TESTS_FAST)

test-async-slow:
	@NODE_ENV=test ./node_modules/expresso/bin/expresso \
		--timeout 6000 \
		$(TESTFLAGS) \
		$(ASYNC_TESTS_SLOW)

test-serial-fast:
	@NODE_ENV=test ./node_modules/expresso/bin/expresso \
		--serial \
		$(TESTFLAGS) \
		$(SERIAL_TESTS_FAST)

test-serial-slow:
	@NODE_ENV=test ./node_modules/expresso/bin/expresso \
		--serial \
		--timeout 6000 \
		$(TESTFLAGS) \
		$(SERIAL_TESTS_SLOW)

test-async: test-async-fast
test-serial: test-serial-fast test-serial-slow
test-fast: test-async-fast test-serial-fast
test-slow: test-serial-slow

test: test-async-fast

test-cov:
	@TESTFLAGS=--cov $(MAKE) test

compile:
	./node_modules/coffee-script/bin/coffee -bw -o ./lib -c ./src
compile-chat:
	./node_modules/coffee-script/bin/coffee -bw -o ./examples/chat/lib -c ./examples/chat/src
compile-examples:
	./node_modules/coffee-script/bin/coffee -bcw ./examples/*/*.coffee
