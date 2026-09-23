Dataworks Track

Dataworks Track is a cross-platform mobile package-tracking and delivery workflow application built for field-based asset and package operations. The app streamlines package intake by combining barcode scanning, carrier-aware tracking-number normalization, bulk delivery submission, recipient signatures, delivery photos, device location capture, and offline/retry support in a single mobile workflow.

The mobile client is built with React Native, TypeScript, and Expo. It communicates with a PHP REST API that handles authentication and package creation in the production backend.

Features

Fast barcode scanning using the device camera with a constrained scan region to reduce accidental reads.

Carrier detection and barcode normalization for Amazon, UPS, FedEx, USPS, GLS, GOFO, and OnTrac tracking formats.

Custom barcode mode for workflows that need to accept arbitrary supported 1D barcodes without carrier validation.

Manual barcode entry as a fallback when a label cannot be scanned reliably.

Duplicate-scan prevention within the current delivery.

Bulk package submission so multiple scanned packages can be sent to the backend in a single delivery request.

Recipient information and delivery notes collected as part of the delivery workflow.

Digital signature capture with signatures persisted locally until the delivery is successfully uploaded.

Delivery photo capture with automatic image resizing/compression before persistence and upload.

Location capture using foreground device coordinates at submission time when permission is available.

Offline/retry workflow that stores failed or deferred deliveries locally and allows users to sync one delivery or the entire queue later.

Active-delivery recovery so partially completed deliveries can survive app restarts.

Account-scoped local storage so saved deliveries and sync queues are separated by signed-in account.

Secure authentication storage using Expo SecureStore for session information.

Scan feedback using audio and haptic feedback for accepted and rejected scans.

Supported Carriers

Standard scanning mode currently recognizes tracking formats for:

Carrier

Examples / handling

Amazon

TBA tracking numbers

UPS

1Z tracking numbers

FedEx

Plain tracking numbers and several observed ASTRA / FDX1D / wrapper formats

USPS

Domestic tracking numbers and international S10 format

GLS

C1|... and supported numeric GLS formats

GOFO

GFUS... tracking numbers

OnTrac

Supported C1... tracking numbers

A separate Custom mode accepts any non-empty barcode returned by the enabled scanner types and stores its carrier as custom.

Application Workflow

Authenticate with the backend and securely store the returned session token.

Start a delivery and scan one or more package barcodes.

The scanner cleans and normalizes the barcode, identifies the carrier when possible, rejects unsupported values, and prevents duplicate packages from being added.

Review the scanned package list and enter the recipient's last name and optional notes.

Optionally capture a delivery photo and capture the required recipient signature.

At submission time, the app requests the device's current coordinates when location permission is available.

The complete delivery is sent to the PHP REST API as a multipart request. The package array is serialized once, allowing the backend to process multiple packages in a single request while sharing delivery-level metadata such as recipient, location, photo, and signature.

If the delivery cannot be uploaded, it can be stored locally and retried from the Saved Deliveries screen.

Architecture

React Native / Expo Mobile Client
        |
        |  HTTPS / REST
        v
PHP REST API
        |
        v
Production Database / Backend Storage

The client is organized around a delivery context that maintains the current delivery state across screens. Persistent local storage is used for recoverable deliveries and the offline sync queue, while sensitive authentication data is stored separately with SecureStore.

Mobile client responsibilities

Authentication and session persistence

Camera/barcode interaction

Tracking-number normalization and carrier classification

Delivery state management

Duplicate prevention

Photo compression and local file persistence

Signature capture

Location capture

Local recovery and queued synchronization

Multipart REST requests to the backend

Backend integration

The repository contains the mobile client and its TypeScript API adapters. The PHP backend implementation and production database schema are maintained separately and are not included in this repository.

The client currently integrates with REST endpoints for:

User authentication

Bulk package/delivery creation

Package creation uses a multipart request containing a JSON array of packages plus delivery-level metadata and media files. Authentication is sent using a bearer token.

Offline and Recovery Design

Dataworks Track is designed to preserve field work when a delivery cannot immediately reach the server.

The active delivery is persisted locally as it changes.

Photos and signatures are copied into app-managed delivery directories so temporary camera/file URIs do not invalidate a saved delivery.

Failed or intentionally deferred deliveries can be moved into an account-specific sync queue.

Each queued delivery records its queue time, upload-attempt count, and most recent upload error.

Users can retry an individual delivery or sync the full queue.

Successfully uploaded deliveries have their associated local files and queue records cleaned up.

The storage layer also includes migration logic for deliveries created by an earlier version of the application that stored raw barcode arrays instead of structured package objects.

Barcode Processing

The scanner does more than capture raw camera output. In Standard mode, each scan passes through carrier-specific normalization rules before it is accepted.

For example, the application can extract the actual tracking number from supported FedEx wrapper formats rather than storing the complete encoded barcode. It also rejects known non-tracking values and limits accepted numeric patterns to reduce accidental scans of routing or product barcodes.

The scanner additionally:

restricts acceptance to barcodes detected inside the visible scan frame;

suppresses rapid repeat callbacks for the same barcode;

prevents duplicate tracking numbers within a delivery; and

provides immediate success/failure feedback to the user.

Tech Stack

Mobile

React 19

React Native 0.81

TypeScript

Expo SDK 54

Expo Router

Expo Camera

Expo Location

Expo SecureStore

Expo FileSystem

Expo Image Manipulator

Expo Audio / Haptics

AsyncStorage

react-native-signature-canvas

Backend Integration

PHP REST API

JSON and multipart/form-data requests

Bearer-token authentication

Relational database-backed package workflows

Project Structure

app/                    Expo Router screens
  index.tsx             Startup/authentication routing
  login.tsx             User authentication
  home-screen.tsx       Main navigation and delivery entry point
  scan.tsx              Barcode scanner and normalization logic
  package.tsx           Delivery review and submission
  photo.tsx             Delivery photo capture
  signature.tsx         Recipient signature capture
  sync.tsx              Saved-delivery retry/synchronization
  settings.tsx          Scanner feedback settings

api/
  auth.ts               Authentication REST client
  packages.ts           Bulk package/delivery REST client

context/
  DeliveryContext.tsx   Shared delivery state and persistence workflow

storage/
  accountStorage.ts     Account identity persistence
  deliveryStorage.ts    Active delivery, queue, and local file storage
  soundSettings.ts      Scanner feedback preferences

types/
  delivery.ts           Delivery, package, carrier, and queue types

constants/
  scanSounds.ts         Scanner feedback audio configuration

Getting Started

Prerequisites

Node.js and npm

Expo tooling

Android Studio / Android device for Android development, or the equivalent iOS development environment for iOS

Access to the Dataworks Track PHP backend

A valid backend user account

Because the application uses native device capabilities such as the camera, location, secure storage, file storage, audio, and signatures, testing on a physical device or development build is recommended.

Installation

Clone the repository and install dependencies:

git clone <repository-url>
cd dataworks-track
npm install

Start the Expo development server:

npx expo start

Useful project scripts include:

npm run android
npm run ios
npm run web
npm run lint

Backend configuration: The API host is currently referenced by the API client source files. For another deployment environment, update the authentication and package API URLs or refactor them into environment-based configuration before building the application.

Android Build

The repository includes Android native project files and EAS configuration. A local Android development build can be launched with:

npm run android

EAS configuration is available in eas.json for Expo Application Services workflows.

Security and Data Handling

Authentication tokens are stored with Expo SecureStore rather than AsyncStorage.

Delivery queues are scoped to the currently authenticated account.

Package submission requires authentication and sends the bearer token to the backend.

Recipient signatures are required before a delivery can be submitted.

Location is requested only at delivery submission and gracefully falls back to null coordinates if permission is denied.

Delivery media is persisted into app-managed storage while queued and deleted after successful upload or explicit deletion.

For production deployments, backend authorization, input validation, database constraints, credential management, transport security, and server-side access controls remain authoritative and should not rely solely on client-side validation.

Current Scope

This repository represents the mobile client for the Dataworks Track workflow. The PHP API and database implementation are separate components of the production system and therefore cannot be reproduced from this repository alone.

The current client supports package intake, delivery metadata, media/signature capture, location collection, bulk REST submission, and resilient local synchronization.

Future Improvements

Potential improvements include:

Environment-based API configuration for development, staging, and production

Automated tests for carrier normalization and delivery persistence

Additional scanner analytics and diagnostics

Expanded administrative configuration

Additional carrier formats as operational requirements evolve

Improved network-awareness and automatic background synchronization

Author

Angel Estrada
Computer Science, California State University, Bakersfield

Dataworks Track was developed to support real-world package and asset-management workflows at California State University, Bakersfield.