# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The first users are individual researchers and technical knowledge workers who need to build and revisit an understanding of a topic. Students, analysts, engineers, and research teams are also in scope.

## Product Purpose

Synthex is an AI-native workspace for turning research into persistent, structured knowledge. A user should be able to start with a question, gather sources, review proposed knowledge, explore its relationships, and reuse the resulting context in reports or other AI systems.

## Positioning

The product combines AI-assisted research with a persistent semantic knowledge graph, provenance, human review, and portable context. The graph is the source of truth; the canvas is one way to work with it.

## Operating Context

The product is desktop-first. Core work moves between asking a question, gathering sources, structuring concepts and claims, inspecting relationships and evidence, reviewing AI-proposed changes, and exporting knowledge.

## Capabilities and Constraints

The requested MVP includes project workspaces, an interactive graph canvas, concepts, notes, sources, claims, questions and groups, semantic relationships, URL and Markdown import, graph-grounded AI chat, quick research, reviewable AI proposals, provenance, search, undo/redo, autosave, and Mermaid, JSON, and CONTEXT.md exports. Research outputs must not be presented as verified facts without evidence or silently committed to the graph.

The current local MVP implements project workspaces, graph editing, reviewable Gemini research proposals, graph-grounded chat, search, history, and JSON, Mermaid, and context Markdown exports. Authentication and invites, URL/Markdown source ingestion, embeddings/vector search, hosted storage, and multi-user synchronization remain deferred until their providers and deployment target are chosen.

The existing implementation uses Next.js 16.3.6, React 19, TypeScript, Tailwind CSS 4, and a local SQLite database. The authentication provider, hosting target, and production database are undecided.

## Brand Commitments

The interface should feel calm, precise, technical, trustworthy, and premium. The request specifies a light workspace, subtle grid, restrained semantic color, thin borders, generous whitespace, and compact controls. It should not read as a generic whiteboard, notes clone, or chat wrapper.

## Evidence on Hand

The repository contains an interactive canvas prototype with SQLite persistence and a Gemini integration. The request references an uploaded visual screenshot; no separate image asset was present beside the pasted brief. Do not invent research sources, citations, customers, or performance claims.

## Product Principles

- Keep the structured graph as the durable source of truth.
- Let AI propose changes and let people review them before committing.
- Preserve provenance so important claims can be traced to sources.
- Keep dense knowledge legible through focused views and progressive disclosure.
- Let research accumulate and remain reusable over time.

## Accessibility & Inclusion

Support keyboard navigation, visible focus, labeled controls, appropriate contrast, and reduced motion. Canvas actions should have keyboard alternatives where practical.
