compile:
	./node_modules/racer/node_modules/coffee-script/bin/coffee -bw -o ./lib -c ./src

MOCHA_TESTS := $(shell find test/ -name '*.mocha.coffee')
MOCHA := ./node_modules/racer/node_modules/mocha/bin/mocha
OUT_FILE = "test-output.tmp"

g = "."

test-mocha:
	@NODE_ENV=test $(MOCHA) \
	  --colors \
		--reporter spec \
		--grep "$(g)" \
		$(MOCHA_TESTS) | tee $(OUT_FILE)

test: test-mocha
test!:
	@perl -n -e '/\[31m  0\) (.*?).\[0m/ && print "make test g=\"$$1\$$\""' $(OUT_FILE) | sh
