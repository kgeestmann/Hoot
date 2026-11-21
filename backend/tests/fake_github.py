import httpx

from backend.app import github

ACCESS_TOKEN = "gho_access-token"
REFRESH_TOKEN = "ghr_refresh-token"


class FakeGitHub:
    """Stands in for GitHub's token, user and GraphQL endpoints and records every request."""

    def __init__(self):
        self.requests: list[httpx.Request] = []
        self.token_response = httpx.Response(
            200,
            json={
                "access_token": ACCESS_TOKEN,
                "expires_in": 28800,
                "refresh_token": REFRESH_TOKEN,
                "refresh_token_expires_in": 15811200,
                "token_type": "bearer",
                "scope": "",
            },
        )
        self.user_response = httpx.Response(200, json={"id": 4242, "login": "octocat"})
        # Answered in order; the last one is repeated for any further request.
        self.graphql_responses: list[httpx.Response] = [httpx.Response(200, json={"data": {}})]
        self.installations_response = httpx.Response(200, json={"total_count": 0, "installations": []})
        self.unreachable = False

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.unreachable:
            raise httpx.ConnectError("connection refused", request=request)
        url = _without_query(request.url)
        if url == github.TOKEN_URL:
            return self.token_response
        if url == github.USER_URL:
            return self.user_response
        if url == github.INSTALLATIONS_URL:
            return self.installations_response
        if url == github.GRAPHQL_URL:
            if len(self.graphql_responses) > 1:
                return self.graphql_responses.pop(0)
            last = self.graphql_responses[0]
            return httpx.Response(last.status_code, content=last.content)
        return httpx.Response(404)

    def requests_to(self, url: str) -> list[httpx.Request]:
        """Return the recorded requests to one endpoint."""
        return [request for request in self.requests if _without_query(request.url) == url]


def _without_query(url: httpx.URL) -> str:
    return str(url.copy_with(query=None))
