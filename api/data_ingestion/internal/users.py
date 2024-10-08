import asyncio
import json
from secrets import token_urlsafe

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from kiota_abstractions.headers_collection import HeadersCollection
from loguru import logger
from msgraph.generated.groups.groups_request_builder import GroupsRequestBuilder
from msgraph.generated.models.invitation import Invitation
from msgraph.generated.models.o_data_errors.o_data_error import ODataError
from msgraph.generated.models.object_identity import ObjectIdentity
from msgraph.generated.models.password_profile import PasswordProfile
from msgraph.generated.models.user import User
from msgraph.generated.users.users_request_builder import UsersRequestBuilder
from pydantic import UUID4, ValidationError

from data_ingestion.schemas.group import GraphGroup
from data_ingestion.schemas.invitation import (
    GraphInvitationCreateRequest,
)
from data_ingestion.schemas.user import (
    GraphUser,
    GraphUserCreateRequest,
    GraphUserCreateResponse,
    GraphUserUpdateRequest,
)
from data_ingestion.settings import settings

from .auth import graph_client


class UsersApi:
    get_user_query_parameters = (
        UsersRequestBuilder.UsersRequestBuilderGetQueryParameters(
            select=[
                "id",
                "mail",
                "mailNickname",
                "displayName",
                "userPrincipalName",
                "accountEnabled",
                "externalUserState",
                "givenName",
                "surname",
                "otherMails",
                "identities",
            ],
            orderby=["displayName", "mail", "userPrincipalName"],
            top=999,
        )
    )
    user_request_config = (
        UsersRequestBuilder.UsersRequestBuilderGetRequestConfiguration(
            query_parameters=get_user_query_parameters,
        )
    )
    get_group_query_parameters = (
        GroupsRequestBuilder.GroupsRequestBuilderGetQueryParameters(
            select=["id", "description", "displayName"],
        )
    )
    group_request_headers = HeadersCollection()
    group_request_headers.add("ConsistencyLevel", "eventual")
    group_request_config = (
        GroupsRequestBuilder.GroupsRequestBuilderGetRequestConfiguration(
            query_parameters=get_group_query_parameters,
            headers=group_request_headers,
        )
    )

    @staticmethod
    def get_user_email_from_api(user: GraphUser) -> str | None:
        if user.mail is not None:
            return user.mail

        if "#EXT#" in user.user_principal_name:
            if user.other_mails is not None and len(user.other_mails) > 0:
                return user.other_mails[0]
            else:
                escaped_email_part = user.user_principal_name.split("#EXT#")[0]
                return "@".join(escaped_email_part.rsplit("_", 1))

        if user.identities is not None and len(user.identities) > 0:
            email_identity = next(
                (id for id in user.identities if id.sign_in_type == "emailAddress"),
                None,
            )
            if email_identity is not None:
                return email_identity.issuer_assigned_id

    @classmethod
    async def list_users(cls) -> list[GraphUser]:
        try:
            users_out = []
            users = await graph_client.users.get(
                request_configuration=cls.user_request_config
            )
            while True:
                if users and users.value:
                    for val in users.value:
                        u = GraphUser(**jsonable_encoder(val))
                        if not u.mail:
                            u.mail = cls.get_user_email_from_api(u)
                        users_out.append(u)

                if users.odata_next_link is None:
                    break

                users = await graph_client.users.with_url(users.odata_next_link).get(
                    request_configuration=cls.user_request_config
                )

            return sorted(users_out, key=lambda u: u.mail)
        except ODataError as err:
            logger.error(err.error.message)
            raise HTTPException(
                detail=err.error.message, status_code=err.response_status_code
            ) from err

    @classmethod
    async def get_user(cls, id: UUID4) -> GraphUser:
        try:
            user, groups = await asyncio.gather(
                graph_client.users.by_user_id(str(id)).get(
                    request_configuration=cls.user_request_config
                ),
                graph_client.users.by_user_id(str(id)).member_of.get(
                    request_configuration=cls.group_request_config
                ),
            )
            user.member_of = [
                g for g in groups.value if g.odata_type == "#microsoft.graph.group"
            ]
            if not user.mail:
                user.mail = cls.get_user_email_from_api(user)

            return user
        except ODataError as err:
            logger.error(err.message)
            raise HTTPException(
                detail=err.error.message, status_code=err.response_status_code
            ) from err

    @classmethod
    async def edit_user(cls, id: UUID4, request_body: GraphUserUpdateRequest) -> None:
        try:
            body = User(
                **{k: v for k, v in request_body.model_dump().items() if v is not None}
            )
            await graph_client.users.by_user_id(str(id)).patch(body=body)
        except ODataError as err:
            logger.error(err.message)
            raise HTTPException(
                detail=err.error.message, status_code=err.response_status_code
            ) from err

    @classmethod
    async def create_user(
        cls, request_body: GraphUserCreateRequest
    ) -> GraphUserCreateResponse:
        temporary_password = token_urlsafe(12)
        try:
            body = User(
                given_name=request_body.given_name,
                surname=request_body.surname,
                display_name=f"{request_body.given_name} {request_body.surname}",
                mail=request_body.email,
                account_enabled=True,
                password_profile=PasswordProfile(
                    force_change_password_next_sign_in=False,
                    password=temporary_password,
                ),
                identities=[
                    ObjectIdentity(
                        sign_in_type="emailAddress",
                        issuer=settings.AUTHORITY_DOMAIN,
                        issuer_assigned_id=request_body.email,
                    )
                ],
                user_type="Member",
            )
            user = await graph_client.users.post(body)
            user_jsonable = jsonable_encoder(user)

            try:
                user_model = GraphUser(**user_jsonable)
                return GraphUserCreateResponse(
                    user=user_model, temporary_password=temporary_password
                )
            except ValidationError as err:
                logger.error(err.message)
                logger.debug(json.dumps(user_jsonable, indent=2))
        except ODataError as err:
            logger.error(err.message)
            raise HTTPException(
                detail=err.error.message, status_code=err.response_status_code
            ) from err

    @classmethod
    async def send_user_invite(
        cls, request_body: GraphInvitationCreateRequest
    ) -> Invitation:
        try:
            body = Invitation(
                **request_body.model_dump(),
                invite_redirect_url=settings.WEB_APP_REDIRECT_URI,
                send_invitation_message=True,
                invited_user_type="Member",
            )
            return await graph_client.invitations.post(body=body)
        except ODataError as err:
            logger.error(err.message)
            raise HTTPException(
                detail=err.error.message, status_code=err.response_status_code
            ) from err

    @classmethod
    async def get_group_memberships(cls, id: UUID4):
        try:
            groups = await graph_client.users.by_user_id(str(id)).member_of.get(
                request_configuration=cls.group_request_config
            )
            if groups and groups.value:
                return [
                    GraphGroup(**jsonable_encoder(g))
                    for g in groups.value
                    if g.odata_type == "#microsoft.graph.group"
                ]
            return []
        except ODataError as err:
            logger.error(err.message)
            raise HTTPException(
                detail=err.error.message, status_code=err.response_status_code
            ) from err
