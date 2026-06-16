"""Notification system with SMTP email delivery."""

import os
import uuid
import logging
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

NOTIFICATION_TEMPLATES = {
    "group_submitted": {
        "subject": "Group submitted for visa processing",
        "body": "Group {group_id} ({passenger_count} passengers) has been submitted. Invoice: ${amount} due {due_date}",
    },
    "vendor_assigned": {
        "subject": "NEW GROUP ASSIGNMENT",
        "body": "Group {group_id} from {client} ({passenger_count} pax) assigned. Deadline: {deadline}",
    },
    "visa_submitted": {
        "subject": "Form submitted to Iraq evisa",
        "body": "Group {group_id} form submitted to Iraq. Awaiting approval (5-15 days)",
    },
    "visa_approved": {
        "subject": "VISAS APPROVED",
        "body": "Iraq has approved all visas for group {group_id}. Visas ready for download",
    },
    "visa_rejected": {
        "subject": "VISA REJECTION - ACTION NEEDED",
        "body": "Group {group_id}: {rejection_reason}. Please fix and resubmit",
    },
    "payment_due": {
        "subject": "Invoice due in 7 days",
        "body": "Invoice {invoice_id}: ${amount} due {due_date}",
    },
    "payment_overdue": {
        "subject": "PAYMENT OVERDUE",
        "body": "Invoice {invoice_id} overdue by {days} days. Please pay immediately",
    },
    "group_split": {
        "subject": "Group split into batches",
        "body": "Group {group_id} has been split into {count} batches for faster processing",
    },
}


def render_template(notif_type: str, context: dict) -> tuple[str, str]:
    template = NOTIFICATION_TEMPLATES.get(notif_type, {"subject": "Notification", "body": "{body}"})
    subject = template["subject"].format(**context)
    body = template["body"].format(**context)
    return subject, body


async def send_email_smtp(to: str, subject: str, body: str) -> bool:
    host = os.environ.get("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASS")
    from_addr = os.environ.get("SMTP_FROM", user or "noreply@acftourism.com")

    if not host:
        logger.warning("SMTP not configured, skipping email to %s", to)
        return False

    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            if user and password:
                server.login(user, password)
            server.sendmail(from_addr, [to], msg.as_string())
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
        return False


async def send_notification(
    db,
    user_id: str,
    notif_type: str,
    title: str,
    body: str,
    group_id: Optional[str] = None,
    send_email: bool = True,
):
    channels = ["system"]
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "related_group_id": group_id,
        "channels_sent": channels,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read_at": None,
    }

    if send_email:
        user = await db.users.find_one({"id": user_id})
        if user and user.get("email"):
            if await send_email_smtp(user["email"], title, body):
                notification["channels_sent"].append("email")

    await db.notifications.insert_one(notification)
    return notification


async def notify_users_by_role(db, roles: list, notif_type: str, context: dict, group_id: Optional[str] = None):
    title, body = render_template(notif_type, context)
    users = await db.users.find({"role": {"$in": roles}, "status": {"$ne": "inactive"}}).to_list(1000)
    for user in users:
        await send_notification(db, user["id"], notif_type, title, body, group_id)
