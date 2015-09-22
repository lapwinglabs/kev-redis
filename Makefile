DBPATH := test/db/redis

test: $(DBPATH) install-redis
		@LOG=test* ./node_modules/.bin/prok \
		--env test/env.test \
		--procfile test/Procfile.test \
		--root .

install:
	@npm install

$(DBPATH):
	@mkdir -p $@

install-redis:
ifeq (,$(shell which redis-server))
	@echo installing redis...
	@brew install redis
else
endif

.PHONY: test
