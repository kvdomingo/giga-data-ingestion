from datetime import datetime
from enum import Enum
from pathlib import Path

from pydantic import UUID4, EmailStr
from sqlalchemy import JSON, VARCHAR, DateTime, String, func
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column

from data_ingestion.constants import constants

from .base import BaseModel


class DQStatusEnum(Enum):
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"
    TIMEOUT = "TIMEOUT"
    SKIPPED = "SKIPPED"


class FileUpload(BaseModel):
    __tablename__ = "file_uploads"

    created: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    uploader_id: Mapped[UUID4] = mapped_column(VARCHAR(36), nullable=False, index=True)
    uploader_email: Mapped[EmailStr] = mapped_column(String(), nullable=False)
    dq_report_path: Mapped[str] = mapped_column(nullable=True, default=None)
    dq_full_path: Mapped[str] = mapped_column(nullable=True, default=None)
    dq_status: Mapped[DQStatusEnum] = mapped_column(
        nullable=False, default=DQStatusEnum.IN_PROGRESS
    )
    bronze_path: Mapped[str] = mapped_column(nullable=True, default=None)
    is_processed_in_staging: Mapped[bool] = mapped_column(nullable=False, default=False)
    country: Mapped[str] = mapped_column(VARCHAR(3), nullable=False)
    dataset: Mapped[str] = mapped_column(nullable=False)
    source: Mapped[str] = mapped_column(nullable=True)
    original_filename: Mapped[str] = mapped_column(nullable=False)
    column_to_schema_mapping: Mapped[dict] = mapped_column(
        JSON, nullable=False, server_default='"{}"'
    )
    column_license: Mapped[dict] = mapped_column(
        JSON, nullable=False, server_default='"{}"'
    )

    @hybrid_property
    def filename(self) -> str:
        timestamp = self.created.strftime("%Y%m%d-%H%M%S")
        ext = Path(self.original_filename).suffix
        country = "N-A" if self.country == "N/A" else self.country
        filename_elements = [self.id, country, self.dataset]
        if self.source is not None:
            filename_elements.append(self.source)

        filename_elements.append(timestamp)
        filename = "_".join(filename_elements)
        return f"{filename}{ext}"

    @hybrid_property
    def upload_path(self) -> str:
        filename_parts = [
            constants.UPLOAD_PATH_PREFIX,
            self.dataset
            if self.dataset == "unstructured"
            else f"school-{self.dataset}",
            "$NA" if self.country == "N/A" else self.country,
            self.filename,
        ]
        return "/".join(filename_parts)
