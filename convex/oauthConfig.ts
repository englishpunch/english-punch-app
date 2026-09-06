export const OAUTH_ISSUER = "https://ep.echoja.com";
export const MCP_RESOURCE = "https://mcp-ep.echoja.com/mcp";

export const MCP_OAUTH_SCOPES = [
  "profile:read",
  "bags:read",
  "bags:write",
  "cards:read",
  "cards:write",
  "reviews:read",
  "reviews:write",
] as const;

export const oauthAuthorizationServerMetadata = {
  issuer: OAUTH_ISSUER,
  authorization_endpoint: `${OAUTH_ISSUER}/oauth/authorize`,
  token_endpoint: `${OAUTH_ISSUER}/oauth/token`,
  jwks_uri: `${OAUTH_ISSUER}/oauth/jwks`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  client_id_metadata_document_supported: true,
  authorization_response_iss_parameter_supported: true,
  scopes_supported: MCP_OAUTH_SCOPES,
};

export const oauthPublicJwk = {
  kty: "RSA",
  n: "td6vt62B5gmNxfiOQfGmYipTuBuqr4G5z4SskbO0bR-krQrmkzrGw6w9R1mqobtsuGwErnHKNJvljWGyeUcBESDIMYnB_DzFxrVi3g43bgD7h8SvtgunySNShDISQo94v1kER1BgBhcmgW5pCskq0oxwuKfAxYAmCeAx1cX4CNTl3TLOWhD-XOF9Ctbaa-mqvThhsT06AWxmJNUXbVCxU81ix-RTTy43cXVidMTd16KMc1ev7swslgOeYDhp_C2R-YpZsSvhgSbjvjPJCgu81ynzCeE064NBUlQ6BlcKxrFTDKEzSGgOZDdlATk86BxH2ta02mQsjh2CFf2wdxlRGQ",
  e: "AQAB",
  kid: "ep-oauth-2026-08-20",
  alg: "RS256",
  use: "sig",
} as const;
