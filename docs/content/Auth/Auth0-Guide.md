---
title: Auth0 Guide
permalink: /security/jwt/auth0
category: Authentication & Authorization
menuOrder: 1
---

## Introduction

In this guide, we'll learn how to integrate Auth0 authentication with a Cube.js
deployment. If you already have a pre-existing application on Auth0 that you'd
like to re-use, please skip ahead to [Configure Cube.js to use Auth0](#).

## Create and configure an application on Auth0

First, go to the [Auth0 dashboard][link-auth0-app], and click on the
'Applications' menu option on the left and then click the '+ Create Application'
button.

> Picture here

In the 'Create Application' popup, set the name of your application and select
'Single Page Web Applications'.

> Picture here

Next, go to the application's settings and add the appropriate callback URLs for
your application (`http://localhost:4000` for the Developer Playground).

### Custom claims

You can also configure custom claims for your JWT token. Auth0 has two SDKs
available; [Auth0.js][link-auth0-js] and the [Auth0 SPA
SDK][link-auth0-spa-sdk]. In either case, you’ll want to open the Auth0
dashboard, click on 'Rules' and add a rule to add any custom claims to the JWT.

#### Auth0.js

Take note of the value of `namespace` here, we will need it to later configure
Cube.js.

```javascript
function (user, context, callback) {
  const namespace = "http://localhost:4000/";
  context.idToken[namespace] =
    {
      'company_id': 'company1',
      'user_id': user.user_id,
      'roles': ['user'],
    };
  callback(null, user, context);
}
```

#### Auth0 SPA SDK

Take note of the value of `namespace` here, we will need it to later configure
Cube.js.

```javascript
function (user, context, callback) {
  const namespace = "http://localhost:4000/";
  context.accessToken[namespace] =
    {
      'company_id': 'company1',
      'user_id': user.user_id,
      'roles': ['user'],
    };
  callback(null, user, context);
}
```

## Create an API on Auth0

If you're using the Auth0 SPA SDK, you'll also need to [create an
API][link-auth0-api]. First, go to the [Auth0 dashboard][link-auth0-app] and
click on the 'APIs' menu option from the left sidebar, then click the '+ Create
API' button.

> Picture here

In the 'New API' popup, set a name for this API and an identifier (e.g.
`cubejs`)

> Picture here

In your application code, configure your API identifier as the audience when
initializing Auth0:

```typescript jsx
<Auth0Provider
  domain={process.env.AUTH_DOMAIN}
  client_id={process.env.AUTH_CLIENT_ID}
  redirect_uri={window.location.origin}
  onRedirectCallback={() => {}}
  audience="cubejs"
>
```

## Configure Cube.js to use Auth0

Now we're ready to configure Cube.js to use Auth0. Go to your Cube.js project
and open the `.env` file and add the following, replacing the values wrapped in
`<>`.

```dotenv
CUBEJS_JWK_URL=https://<AUTH0-DOMAIN>.auth0.com/.well-known/jwks.json
CUBEJS_JWT_AUDIENCE=<APPLICATION_URL>
CUBEJS_JWT_ISSUER=https://<AUTH0-DOMAIN>.auth0.com/
CUBEJS_JWT_ALGS=RS256
CUBEJS_JWT_CLAIMS_NAMESPACE=<CLAIMS_NAMESPACE>
```

## Testing with the Developer Playground

// Get a token

// Paste token into Dev Playground

Now open the Developer Playground (at `http://localhost:4000`) and

> Picture here

[link-auth0-app]: https://manage.auth0.com/
[link-auth0-js]: https://auth0.com/docs/libraries/auth0js
[link-auth0-spa-sdk]: https://auth0.com/docs/libraries/auth0-spa-js
[link-auth0-api]:
  https://auth0.com/docs/tokens/access-tokens#json-web-token-access-tokens
