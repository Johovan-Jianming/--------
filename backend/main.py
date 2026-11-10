"""
西方馆藏未刊清史研究文献数智平台 · 后端服务 (FastAPI)
集成三大 OCR 与智能史料处理引擎：
1. MinerU 官方云端解析 API (https://mineru.net/api/v4)
2. PaddleOCR-VL-1.6 异步版面与文档识读 API (https://paddleocr.aistudio-app.com/api/v2/ocr/jobs)
3. 超算 TokenPlan 大模型 API (sk-tp-*** · 支持多引擎校勘合成、学术翻译、史料提要与史料长编生成)
"""
import asyncio
import json
import os
import httpx
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─── 默认凭证配置（支持前端请求动态覆盖） ───
ONLINE_API_KEY = os.getenv(
    "ONLINE_API_KEY", "sk-tp-ODM5LTIxOTk1ODY0Mzk4LTE3OTI2MzQ2MzEwNzY="
)
ONLINE_BASE_URL = os.getenv(
    "ONLINE_BASE_URL", "https://api.lkeap.cloud.tencent.com/plan/v3"
)
ONLINE_MODEL = os.getenv("ONLINE_MODEL", "deepseek-v3")

MINERU_TOKEN = os.getenv(
    "MINERU_TOKEN", "sk-qdW1brJL9X1kOYcWuRKhrPOPxhCwLD2tn3geHX7zWI7K1ruW"
)
MINERU_BASE_URL = "https://mineru.net"

PADDLE_JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
PADDLE_TOKEN = os.getenv(
    "PADDLE_TOKEN", "80d1c23d689bd9339e2cfb56b722903fd82f763a"
)
PADDLE_MODEL = "PaddleOCR-VL-1.6"

app = FastAPI(title="清史未刊文献数智平台 · 多引擎 OCR 与史料长编后端")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


class PaddleUrlReq(BaseModel):
    file_url: str
    token: str | None = None
    model: str = PADDLE_MODEL


class MineruUrlReq(BaseModel):
    file_url: str
    token: str | None = None
    model_version: str = "vlm"


class ScholarlyTaskReq(BaseModel):
    task_type: str  # "merge_ocr" | "translate" | "summary" | "changbian"
    source_text: str
    mineru_text: str | None = None
    paddle_text: str | None = None
    chinese_master_text: str | None = None
    published_text: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    model: str | None = None


@app.post("/api/ocr/paddle-url")
async def run_paddle_ocr_url(req: PaddleUrlReq):
    """调用 PaddleOCR-VL-1.6 官方异步 Job 接口 (URL 模式)"""
    token = req.token or PADDLE_TOKEN
    headers = {
        "Authorization": f"bearer {token}",
        "Content-Type": "application/json",
    }
    optional_payload = {
        "useDocOrientationClassify": False,
        "useDocUnwarping": False,
        "useChartRecognition": False,
    }
    payload = {
        "fileUrl": req.file_url,
        "model": req.model or PADDLE_MODEL,
        "optionalPayload": optional_payload,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        job_resp = await client.post(PADDLE_JOB_URL, json=payload, headers=headers)
        if job_resp.status_code != 200:
            return {"ok": False, "error": job_resp.text}
        job_id = job_resp.json()["data"]["jobId"]

        jsonl_url = ""
        for _ in range(24):
            res = await client.get(f"{PADDLE_JOB_URL}/{job_id}", headers=headers)
            data = res.json().get("data", {})
            state = data.get("state")
            if state == "done":
                jsonl_url = data.get("resultUrl", {}).get("jsonUrl", "")
                break
            if state == "failed":
                return {"ok": False, "error": data.get("errorMsg", "Job failed")}
            await asyncio.sleep(3)

        if not jsonl_url:
            return {"ok": False, "error": "Polling timeout", "jobId": job_id}

        jsonl_resp = await client.get(jsonl_url)
        pages_md = []
        for line in jsonl_resp.text.strip().split("\n"):
            if not line.strip():
                continue
            row = json.loads(line).get("result", {})
            for item in row.get("layoutParsingResults", []):
                pages_md.append(item.get("markdown", {}).get("text", ""))

        return {
            "ok": True,
            "engine": "PaddleOCR-VL-1.6",
            "jobId": job_id,
            "markdown": "\n\n---\n\n".join(pages_md),
        }


@app.post("/api/ocr/paddle-file")
async def run_paddle_ocr_file(
    file: UploadFile = File(...),
    token: str = Form(default=PADDLE_TOKEN),
):
    """调用 PaddleOCR-VL-1.6 官方异步 Job 接口 (本地文件上传模式)"""
    headers = {"Authorization": f"bearer {token}"}
    optional_payload = {
        "useDocOrientationClassify": False,
        "useDocUnwarping": False,
        "useChartRecognition": False,
    }
    data = {
        "model": PADDLE_MODEL,
        "optionalPayload": json.dumps(optional_payload),
    }
    file_bytes = await file.read()

    async with httpx.AsyncClient(timeout=120) as client:
        job_resp = await client.post(
            PADDLE_JOB_URL,
            headers=headers,
            data=data,
            files={"file": (file.filename, file_bytes, file.content_type or "application/octet-stream")},
        )
        if job_resp.status_code != 200:
            return {"ok": False, "error": job_resp.text}
        job_id = job_resp.json()["data"]["jobId"]
        return {"ok": True, "jobId": job_id, "engine": "PaddleOCR-VL-1.6"}


@app.post("/api/ocr/mineru-url")
async def run_mineru_ocr(req: MineruUrlReq):
    """调用 MinerU v4 官方解析接口"""
    token = req.token or MINERU_TOKEN
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }
    payload = {
        "url": req.file_url,
        "is_ocr": True,
        "enable_formula": True,
        "model_version": req.model_version,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{MINERU_BASE_URL}/api/v4/extract/task",
            headers=headers,
            json=payload,
        )
        return {"ok": r.status_code == 200, "engine": "MinerU-v4", "response": r.json()}


@app.post("/api/scholarly/run")
async def run_scholarly_task(req: ScholarlyTaskReq):
    """使用超算中心 TokenPlan API 进行多引擎OCR校勘合成、学术翻译、史料摘要、史料长编生成"""
    key = req.api_key or ONLINE_API_KEY
    base = (req.base_url or ONLINE_BASE_URL).rstrip("/")
    model = req.model or ONLINE_MODEL

    if req.task_type == "merge_ocr":
        sys_prompt = (
            "你是清史与西方汉学家未刊手稿校勘专家。请对比 MinerU 与 PaddleOCR-VL-1.6 的识读文本，"
            "修正打字稿断词、威妥玛拼音及手写划改符号，输出高精度校订版原文，并简要列出两处关键校勘差异。"
        )
        user_content = f"【MinerU识读】:\n{req.mineru_text}\n\n【PaddleOCR-VL-1.6识读】:\n{req.paddle_text}"
    elif req.task_type == "translate":
        sys_prompt = (
            "你是清代边疆史与海外汉学翻译专家。请将以下未刊档案原文精准译为学术中文，"
            "严格保留原稿中的【初译被划去词】与【上方红笔改写词/页边批注】层次，并附术语对照说明。"
        )
        user_content = req.source_text
    elif req.task_type == "summary":
        sys_prompt = (
            "你是历史文献编目与提要撰述专家。请依据给定档案文本，生成结构化的【史料摘要与目录提要】，"
            "包含：1. 文献形态与出处（区分原文明确与推定）；2. 核心史实提要；3. 知识生产关键发现。"
        )
        user_content = req.source_text
    else:  # changbian (史料长编)
        sys_prompt = (
            "你是中国传统史学‘史料长编（附考异）’纂修专家（仿李焘《续资治通鉴长编》体例）。"
            "请围绕给定史料，将【中文权威母本】、【海外未刊手稿/信札】、【西方已刊专著】按时间编次，"
            "先撰写【长编正文】，再在正文下撰写【考异】按语，逐字指出西方未刊稿如何删节或改写母本概念。"
        )
        user_content = (
            f"【中文母本】:\n{req.chinese_master_text}\n\n"
            f"【海外未刊手稿】:\n{req.source_text}\n\n"
            f"【西方已刊专著】:\n{req.published_text}"
        )

    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.post(
            f"{base}/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_content},
                ],
                "temperature": 0.2,
            },
        )
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"]
    return {"ok": True, "task_type": req.task_type, "result": content}
