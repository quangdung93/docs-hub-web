# Makefile — docs-hub-web
# Chỉ gói các thao tác deploy trên EC2; công việc thường ngày vẫn dùng npm.

EC2_COMPOSE := deployments/ec2/docker-compose.yml
EC2_ENV     := .env.ec2

.DEFAULT_GOAL := help

.PHONY: help
help: ## Hiển thị danh sách lệnh
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: ec2-up
ec2-up: ## Build + chạy web trên EC2
	@test -f $(EC2_ENV) || (echo "❌ Thiếu $(EC2_ENV) — cp .env.ec2.example $(EC2_ENV) rồi điền"; exit 1)
	docker compose -f $(EC2_COMPOSE) --env-file $(EC2_ENV) up -d --build

.PHONY: ec2-down
ec2-down: ## Tắt web trên EC2
	docker compose -f $(EC2_COMPOSE) --env-file $(EC2_ENV) down

.PHONY: ec2-logs
ec2-logs: ## Xem log web
	docker compose -f $(EC2_COMPOSE) --env-file $(EC2_ENV) logs -f web

.PHONY: ec2-ps
ec2-ps: ## Trạng thái web
	docker compose -f $(EC2_COMPOSE) --env-file $(EC2_ENV) ps

.PHONY: ec2-restart
ec2-restart: ## Build lại web sau khi cập nhật code
	docker compose -f $(EC2_COMPOSE) --env-file $(EC2_ENV) up -d --build web

.PHONY: ec2-start
ec2-start: ## Chạy web bằng image có sẵn, KHÔNG build lại (dùng sau ec2-image-push)
	@test -f $(EC2_ENV) || (echo "❌ Thiếu $(EC2_ENV)"; exit 1)
	docker compose -f $(EC2_COMPOSE) --env-file $(EC2_ENV) up -d --no-build

## --------------------------------------------------- Build hộ cho EC2 yếu
# `next build` cần nhiều RAM hơn một instance nhỏ (2 vCPU/4GB) chịu được — build
# ngay trên EC2 dễ làm nghẽn cả máy. Hai lệnh dưới build ở máy dev rồi nạp image
# thẳng vào EC2, không cần registry.
#
#   make ec2-image-push EC2_HOST=ubuntu@1.2.3.4 SSH_KEY=~/key.pem
#   ssh ... 'cd /path/repo && sudo make ec2-start'
#
# Máy dev Apple Silicon phải build --platform linux/amd64 (chạy qua emulation
# nên chậm); máy dev x86 thì bỏ qua cũng được.
PLATFORM ?= linux/amd64
IMAGE    ?= docs-hub-web:ec2

.PHONY: ec2-image-build
ec2-image-build: ## Build image cho EC2 tại máy này
	docker build --platform $(PLATFORM) \
		-f deployments/docker/Dockerfile \
		--build-arg NEXT_PUBLIC_APP_ENV=production \
		-t $(IMAGE) .

.PHONY: ec2-image-push
ec2-image-push: ec2-image-build ## Build rồi nạp image vào EC2 qua SSH
	@test -n "$(EC2_HOST)" || (echo "❌ Thiếu EC2_HOST, ví dụ: make ec2-image-push EC2_HOST=ubuntu@1.2.3.4 SSH_KEY=~/key.pem"; exit 1)
	docker save $(IMAGE) | gzip | \
		ssh $(if $(SSH_KEY),-i $(SSH_KEY),) $(EC2_HOST) 'gunzip | sudo docker load'
