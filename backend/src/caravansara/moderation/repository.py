from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.moderation.models import AdminAddressView


async def record_address_view(session: AsyncSession, admin_id: int, listing_id: int) -> None:
    session.add(AdminAddressView(admin_id=admin_id, listing_id=listing_id))
