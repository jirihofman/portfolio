"use client";

import {
	createContext,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

const SecondaryDataContext = createContext(null);
const STORAGE_KEY = "portfolio:project-secondary:v1";
const CLIENT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LOADER_DELAY_MS = 200;
let memorySnapshot = null;

function isValidPayload(payload) {
	return Boolean(
		payload?.schemaVersion === 1 &&
			typeof payload.generatedAt === "string" &&
			payload.repositories &&
			typeof payload.repositories === "object" &&
			!Array.isArray(payload.repositories),
	);
}

function isUsableSnapshot(snapshot) {
	return Boolean(
		isValidPayload(snapshot) &&
			Number.isFinite(snapshot.cachedAt) &&
			Date.now() - snapshot.cachedAt <= CLIENT_CACHE_MAX_AGE_MS,
	);
}

function readClientSnapshot() {
	if (isUsableSnapshot(memorySnapshot)) {
		return memorySnapshot;
	}

	try {
		const storedSnapshot = JSON.parse(
			window.sessionStorage.getItem(STORAGE_KEY),
		);

		if (isUsableSnapshot(storedSnapshot)) {
			memorySnapshot = storedSnapshot;
			return storedSnapshot;
		}

		window.sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		// Storage can be unavailable in privacy-restricted browser contexts.
	}

	return null;
}

function storeClientSnapshot(payload) {
	const snapshot = {
		schemaVersion: payload.schemaVersion,
		generatedAt: payload.generatedAt,
		repositories: payload.repositories,
		cachedAt: Date.now(),
	};

	memorySnapshot = snapshot;

	try {
		window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
	} catch {
		// The in-memory snapshot still prevents repeat loading in this page session.
	}

	return snapshot;
}

function createReadyState(snapshot) {
	return {
		status: "ready",
		repositories: snapshot.repositories,
		generatedAt: snapshot.generatedAt,
		showLoader: false,
	};
}

export function SecondaryDataProvider({ children }) {
	const [state, setState] = useState({
		status: "restoring",
		repositories: {},
		generatedAt: null,
		showLoader: false,
	});
	const hasCachedData = useRef(false);

	useLayoutEffect(() => {
		const cachedSnapshot = readClientSnapshot();

		if (cachedSnapshot) {
			hasCachedData.current = true;
			setState(createReadyState(cachedSnapshot));
		} else {
			setState((currentState) => ({
				...currentState,
				status: "loading",
			}));
		}
	}, []);

	useEffect(() => {
		let isCurrent = true;
		const loaderTimer = window.setTimeout(() => {
			setState((currentState) =>
				currentState.status === "loading"
					? { ...currentState, showLoader: true }
					: currentState,
			);
		}, LOADER_DELAY_MS);

		fetch("/api/projects/secondary", {
			credentials: "same-origin",
			headers: { Accept: "application/json" },
		})
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`Secondary data returned ${response.status}`);
				}

				const payload = await response.json();

				if (!isValidPayload(payload)) {
					throw new Error("Secondary data has an unsupported shape");
				}

				const snapshot = storeClientSnapshot(payload);

				if (isCurrent) {
					setState((currentState) =>
						currentState.status === "ready" &&
						currentState.generatedAt === snapshot.generatedAt
							? currentState
							: createReadyState(snapshot),
					);
				}
			})
			.catch((error) => {
				console.error("Failed to load project details:", error);

				if (isCurrent && !hasCachedData.current) {
					setState({
						status: "error",
						repositories: {},
						generatedAt: null,
						showLoader: false,
					});
				}
			});

		return () => {
			isCurrent = false;
			window.clearTimeout(loaderTimer);
		};
	}, []);

	return (
		<SecondaryDataContext.Provider value={state}>
			{children}
		</SecondaryDataContext.Provider>
	);
}

export function useProjectSecondaryData(repositoryKey) {
	const context = useContext(SecondaryDataContext);

	if (!context) {
		return {
			status: "disabled",
			repository: null,
			showLoader: false,
		};
	}

	return {
		status: context.status,
		repository: context.repositories[repositoryKey] || null,
		showLoader: context.showLoader,
	};
}
