export class GitHubRequestError extends Error {
    constructor(message, status = 502) {
        super(message);
        this.name = 'GitHubRequestError';
        this.status = status;
    }
}
