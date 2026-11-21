import httpx

from backend.app import github
from backend.app.main import SESSION_COOKIE_NAME, create_access_token

INSTALL_URL = "https://github.com/apps/hoot-test/installations/new"


def installation(login, account_type="Organization", repository_selection="all"):
    """An installation as GitHub's GET /user/installations returns it."""
    return {
        "id": 1,
        "account": {"login": login, "id": 7, "type": account_type},
        "repository_selection": repository_selection,
        "html_url": f"https://github.com/organizations/{login}/settings/installations/1",
        "app_slug": "hoot-test",
    }


def installations_response(*installations):
    return httpx.Response(
        200, json={"total_count": len(installations), "installations": list(installations)}
    )


def get_installations(client, user):
    """Request /github/installations with a session cookie for the given user."""
    client.cookies.set(SESSION_COOKIE_NAME, create_access_token(data={"sub": str(user["id"])}))
    return client.get("/github/installations")


def test_installations_require_a_session(client, fake_github):
    assert client.get("/github/installations").status_code == 401
    assert fake_github.requests == []


def test_lists_where_hoot_is_installed(client, fake_github, user):
    fake_github.installations_response = installations_response(
        installation("octocat", account_type="User"),
        installation("octo-org", repository_selection="selected"),
    )

    response = get_installations(client, user)

    assert response.status_code == 200
    assert response.json() == {
        "install_url": INSTALL_URL,
        "installations": [
            {
                "account": "octocat",
                "account_type": "User",
                "all_repositories": True,
                "settings_url": "https://github.com/organizations/octocat/settings/installations/1",
            },
            {
                "account": "octo-org",
                "account_type": "Organization",
                "all_repositories": False,
                "settings_url": "https://github.com/organizations/octo-org/settings/installations/1",
            },
        ],
    }


def test_no_installation_still_returns_the_install_url(client, fake_github, user):
    response = get_installations(client, user)

    assert response.json() == {"install_url": INSTALL_URL, "installations": []}


def test_installations_are_loaded_with_the_users_token(client, fake_github, user):
    get_installations(client, user)

    [request] = fake_github.requests_to(github.INSTALLATIONS_URL)
    assert request.headers["authorization"] == "Bearer gho_stored-token"
    assert request.url.params["per_page"] == "100"


def test_enterprise_installations_are_left_out(client, fake_github, user):
    enterprise = installation("ignored")
    enterprise["account"] = {"slug": "octo-enterprise", "name": "Octo Enterprise"}
    fake_github.installations_response = installations_response(installation("octo-org"), enterprise)

    response = get_installations(client, user)

    assert [item["account"] for item in response.json()["installations"]] == ["octo-org"]


def test_revoked_token_signs_the_user_out(client, fake_github, user):
    fake_github.installations_response = httpx.Response(401, json={"message": "Bad credentials"})

    response = get_installations(client, user)

    assert response.status_code == 401
    assert any(
        header.startswith(f"{SESSION_COOKIE_NAME}=") and "Max-Age=0" in header
        for header in response.headers.get_list("set-cookie")
    )


def test_unexpected_answer_from_github_answers_502(client, fake_github, user):
    fake_github.installations_response = httpx.Response(200, json={"installations": [{}]})

    assert get_installations(client, user).status_code == 502
