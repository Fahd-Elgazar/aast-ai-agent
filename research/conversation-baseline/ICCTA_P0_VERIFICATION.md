# ICCTA P0 verification

Source base `3e5ef3eaf9f15ec60a3778786e29ed15fe607bb2`. The cleanup candidate and conversation fixes are independent branches. This branch carries the fixture manifest, Docker readiness and demo setup.

## Observed on 22 November 2026

```text
PASS clean Neo4j dump load with exact data and schema fingerprints
PASS Qdrant clean snapshot restore, readyz and calendar evidence, 184 points
PASS Qdrant healthcheck in the revised Compose project
PASS clean Decision health and two synthetic seed runs
PASS both Compose models and Node, PowerShell, sh, Python parsers
PASS both Windows launchers entered the fixture preflight and rejected missing data
```

Neo4j verification used an empty isolated volume. The restored Neo4j 5.26.26 instance matched the observed appliance's 144 nodes, 254 relationships, six RECOMMENDED_AFTER edges, and separate data and schema digests. Qdrant 1.12.5 successfully restored to an empty instance. All 184 live indexed IDs and ten scalar/JSON payload fields per chunk matched the 5 May source corpus before snapshotting. The synthetic Decision seed was run twice on a clean migrated instance to verify restart behavior.

The full `load-fixtures` run and three-turn smoke still need a machine that can run the conference stack without stopping the existing services. The Docker VM allocation was 3.8 GiB and the July-image appliance stayed healthy. Clean checks above verify the components individually. They do not certify the combined frontend, backend, retriever, and Ollama run. [Setup and rehearsal capacity](../../appliance/README.md)

## Dependency advisories

A fresh `npm audit --omit=dev` reported one critical (`proxy-addr`), three high and one moderate in the backend, and three high and two moderate in the frontend. Keep the conference stack on its configured loopback addresses. The critical advisory remains open for release review. No dependency changes are part of this conference stack PR.

## Team handoff

Fahd is the requested reviewer for the stack. The separate cleanup candidate stays pending his independent C00–C03 review. Run the shortlisted prompts against the reviewed joint candidate before tagging or recording the backup. [Cleanup patch](https://github.com/Fahd-Elgazar/aast-ai-agent/blob/a3720097388b66a54ab1202b1ba2b3176562e414/research/conversation-baseline/p0-cleanup.patch) · [Rehearsal shortlist](ICCTA_DEMO_REHEARSAL.md)
