export class AppError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly status = 500
	) {
		super(message);
		this.name = new.target.name;
	}
}

export class ValidationError extends AppError {
	constructor(
		message: string,
		readonly field?: string
	) {
		super(message, 'VALIDATION_ERROR', 400);
	}
}

export class AuthenticationError extends AppError {
	constructor(message = 'Authentication required') {
		super(message, 'AUTHENTICATION_ERROR', 401);
	}
}

export class AuthorizationError extends AppError {
	constructor(message = 'Not authorized') {
		super(message, 'AUTHORIZATION_ERROR', 403);
	}
}

export class ExternalServiceError extends AppError {
	constructor(
		message: string,
		readonly service: string
	) {
		super(message, 'EXTERNAL_SERVICE_ERROR', 502);
	}
}
