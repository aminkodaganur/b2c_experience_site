# Angular Catalog App

Angular 18 app with catalog, product listing, product detail, configure product, cart, and register account.

## Features

- **Browse and Select Catalog** – `/catalog` – Choose a category to browse products
- **Product Listing** – `/products` – List products (optionally by category)
- **Product Detail** – `/product/:id` – View product details
- **Configure Product** – `/configure/:id` – Set quantity and add to cart
- **Cart** – `/cart` – View cart items and total
- **Register Account** – `/register` – Registration form

Uses **Bootstrap 5** for UI and **Angular Router** for navigation.

### Salesforce API integration

The **Product Listing** page loads products from the Salesforce Consumer Products API:

1. **Access token** – `POST` to `{baseUrl}/services/oauth2/token` with `grant_type=client_credentials`, `client_id`, and `client_secret` (from `src/environments/environment.ts`).
2. **Products** – `POST` to `{baseUrl}/services/data/v66.0/connect/consumer/products` with body `{ "productListRequest": { "limit": 100 } }` and header `Authorization: Bearer <access_token>`.

If the browser blocks requests (CORS), use a dev proxy or configure Salesforce to allow your origin. For production, consider using a backend to obtain the token so client credentials are not exposed.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
