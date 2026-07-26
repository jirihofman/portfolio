"use client";

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

const SecondaryDataContext = createContext(null);

export function SecondaryDataProvider({ children }) {
	const [state, setState] = useState({
		status: "loading",
		repositories: {},
	});

	useEffect(() => {
		let isCurrent = true;

		fetch("/api/projects/secondary", {
			credentials: "same-origin",
			headers: { Accept: "application/json" },
		})
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`Secondary data returned ${response.status}`);
				}

				const payload = await response.json();

				if (
					payload?.schemaVersion !== 1 ||
					!payload.repositories ||
					typeof payload.repositories !== "object"
				) {
					throw new Error("Secondary data has an unsupported shape");
				}

				if (isCurrent) {
					setState({
						status: "ready",
						repositories: payload.repositories,
					});
				}
			})
			.catch((error) => {
				console.error("Failed to load project details:", error);

				if (isCurrent) {
					setState({ status: "error", repositories: {} });
				}
			});

		return () => {
			isCurrent = false;
		};
	}, []);

	const value = useMemo(() => state, [state]);

	return (
		<SecondaryDataContext.Provider value={value}>
			{children}
		</SecondaryDataContext.Provider>
	);
}

export function useProjectSecondaryData(repositoryKey) {
	const context = useContext(SecondaryDataContext);

	if (!context) {
		return { status: "disabled", repository: null };
	}

	return {
		status: context.status,
		repository: context.repositories[repositoryKey] || null,
	};
}
