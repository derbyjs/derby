compile:
	./node_modules/coffee-script/bin/coffee -bw -o ./bin/lib -c ./bin/src

MOCHA_TESTS := $(shell find test/ -name '*.mocha.*')
MOCHA := ./node_modules/racer/node_modules/mocha/bin/mocha
OUT_FILE = "test-output.tmp"

g = "."

test-mocha:
	@NODE_ENV=test $(MOCHA) \
		--grep "$(g)" \
		$(MOCHA_TESTS) | tee $(OUT_FILE)

test: test-mocha
test!:
	@perl -n -e '/\[31m  0\) (.*?).\[0m/ && print "make test g=\"$$1\$$\""' $(OUT_FILE) | sh
