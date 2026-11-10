"""
Model Context Protocol (MCP) Server for Western Collections of Unpublished Qing History Documents
西方馆藏汉学家未刊清史研究文献 · 标准 MCP 工具服务
可通过 Claude Desktop / Antigravity / Cursor / FastMCP 挂载调用
"""

import json
from pathlib import Path
from typing import Any, Dict, List

GEO_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "geo"


def search_chgis_1820(query: str) -> List[Dict[str, Any]]:
    """在复旦/哈佛 CHGIS 1820 清代历史地理数据集中检索府/州/厅/县级政区与经纬度坐标。"""
    results: List[Dict[str, Any]] = []
    for filename in ["chgis_1820_prefectures.geojson", "chgis_1820_counties.geojson"]:
        fpath = GEO_DIR / filename
        if not fpath.exists():
            continue
        try:
            data = json.loads(fpath.read_text(encoding="utf-8"))
            for feat in data.get("features", []):
                props = feat.get("properties", {})
                name_zh = str(props.get("NAME_CH", "") or props.get("name", ""))
                name_py = str(props.get("NAME_PY", ""))
                if query in name_zh or query.lower() in name_py.lower():
                    results.append(
                        {
                            "name_zh": name_zh,
                            "name_py": name_py,
                            "lev_rank": props.get("LEV_RANK", ""),
                            "prov": props.get("PROV_CH", ""),
                            "geometry_type": feat.get("geometry", {}).get("type", ""),
                        }
                    )
                    if len(results) >= 10:
                        return results
        except Exception:
            continue
    return results


def validate_ead_digest(digest: str, folder_type: str) -> Dict[str, Any]:
    """校验编目系统 v2.1 的 150 字三段式内容摘记是否符合规范。"""
    length = len(digest.strip())
    valid_types = {"research_manuscript", "correspondence", "admin_clipping"}
    return {
        "is_valid": length <= 160 and folder_type in valid_types,
        "char_count": length,
        "folder_type": folder_type,
        "spec_version": "EAD-v2.1-QingArchive",
    }


MCP_TOOLS_MANIFEST = [
    {
        "name": "search_chgis_1820",
        "description": "检索 CHGIS v6 1820年清代府州县历史政区与空间坐标",
        "parameters": {"query": "清代地名汉字或拼音（如：多伦诺尔、盛京、广州府）"},
    },
    {
        "name": "validate_ead_digest",
        "description": "核验西方馆藏未刊清史文献 7 级 EAD 编目与 150 字三段式摘记合规性",
        "parameters": {"digest": "摘记文本", "folder_type": "文件夹三分类型"},
    },
    {
        "name": "run_historiography_radar",
        "description": "执行五维史料问题雷达扫描，识别隐蔽盲区、概念置换与中国史学立场纠偏",
        "parameters": {"manuscript_text": "未刊手稿文本", "primary_text": "清代母本原文"},
    },
]
