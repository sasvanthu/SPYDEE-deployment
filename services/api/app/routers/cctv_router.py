from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.auth.auth import get_current_user
from app.models.models import (
    User, Case, EvidenceFile,
)
from app.services.case_service import check_case_membership
from app.schemas.schemas import (
    CCTVObservationResponse, CCTVObservationListResponse,
)

router = APIRouter(prefix="/api/v1/cctv", tags=["cctv"])


def _uuid(value) -> UUID:
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid UUID: {value}")


def _cctv_obs_response(obs: dict) -> CCTVObservationResponse:
    return CCTVObservationResponse(
        id=obs["id"],
        case_id=obs["case_id"],
        camera_id=obs["camera_id"],
        location=obs["location"],
        lat=obs["lat"],
        lon=obs["lon"],
        timestamp=obs["timestamp"],
        frame_reference=obs.get("frame_reference"),
        signals=obs["signals"],
        confidence=obs["confidence"],
        status=obs["status"],
        contributing_signals=obs["contributing_signals"],
        created_at=obs.get("created_at"),
        updated_at=obs.get("updated_at"),
    )


@router.get("/{case_id}/observations", response_model=CCTVObservationListResponse)
async def get_cctv_observations(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cid = _uuid(case_id)
    await check_case_membership(db, user.id, cid)

    case_res = await db.get(Case, cid)
    if case_res is None:
        raise HTTPException(status_code=404, detail="Case not found")

    cctv_evidence = await db.execute(
        select(EvidenceFile).where(
            EvidenceFile.case_id == cid,
            EvidenceFile.source_type == "CCTV"
        )
    )
    cctv_files = cctv_evidence.scalars().all()

    observations = []
    for f in cctv_files:
        obs_id = f"CCTV-{str(f.id)[:8].upper()}"
        observations.append({
            "id": obs_id,
            "case_id": str(cid),
            "camera_id": f"CAM-{f.original_filename.split('.')[0].upper()}",
            "location": f.source_description or "Unknown location",
            "lat": 0.0,
            "lon": 0.0,
            "timestamp": f.created_at.isoformat() if f.created_at else datetime.utcnow().isoformat(),
            "frame_reference": f"FRAME-{f.created_at.strftime('%Y%m%d-%H%M%S') if f.created_at else 'UNKNOWN'}-{str(f.id)[:4]}",
            "signals": {
                "appearance": 0.72,
                "telecom": 0.65,
                "temporal": 0.91,
            },
            "confidence": "MEDIUM",
            "status": "inferred — not confirmed",
            "contributing_signals": 3,
            "created_at": f.created_at,
            "updated_at": f.created_at,
        })

    return CCTVObservationListResponse(observations=observations)


@router.get("/{case_id}/observations/{obs_id}", response_model=CCTVObservationResponse)
async def get_cctv_observation(
    case_id: str,
    obs_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cid = _uuid(case_id)
    await check_case_membership(db, user.id, cid)

    cctv_evidence = await db.execute(
        select(EvidenceFile).where(
            EvidenceFile.case_id == cid,
            EvidenceFile.source_type == "CCTV"
        )
    )
    cctv_files = cctv_evidence.scalars().all()

    for f in cctv_files:
        obs_id_generated = f"CCTV-{str(f.id)[:8].upper()}"
        if obs_id_generated == obs_id:
            return _cctv_obs_response({
                "id": obs_id,
                "case_id": str(cid),
                "camera_id": f"CAM-{f.original_filename.split('.')[0].upper()}",
                "location": f.source_description or "Unknown location",
                "lat": 0.0,
                "lon": 0.0,
                "timestamp": f.created_at.isoformat() if f.created_at else datetime.utcnow().isoformat(),
                "frame_reference": f"FRAME-{f.created_at.strftime('%Y%m%d-%H%M%S') if f.created_at else 'UNKNOWN'}-{str(f.id)[:4]}",
                "signals": {
                    "appearance": 0.72,
                    "telecom": 0.65,
                    "temporal": 0.91,
                },
                "confidence": "MEDIUM",
                "status": "inferred — not confirmed",
                "contributing_signals": 3,
                "created_at": f.created_at,
                "updated_at": f.created_at,
            })

    raise HTTPException(status_code=404, detail="CCTV observation not found")