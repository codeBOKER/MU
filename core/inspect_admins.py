import asyncio

from sqlmodel import select

from app.db.session import async_session_factory
from app.models.admin import AdminUser
from app.core.config import settings


async def main():
    # Hide database password before printing the URL
    db_url = settings.database_url
    safe_url = db_url.split("@")[-1] if "@" in db_url else db_url
    print("Database:", safe_url)

    async with async_session_factory() as session:
        result = await session.exec(select(AdminUser))
        admins = result.all()

        if not admins:
            print("No admin accounts found.")
            return

        print(f"\nFound {len(admins)} admin account(s):\n")

        for admin in admins:
            print(f"ID: {admin.id}")
            print(f"Email: {admin.email}")
            print(f"Name: {admin.full_name}")
            print(f"Role: {admin.role}")
            print(f"Active: {admin.is_active}")
            print("-" * 35)


if __name__ == "__main__":
    asyncio.run(main())
