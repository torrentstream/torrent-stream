import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";
import { brotliCompressSync, brotliDecompressSync } from "node:zlib";
import { deploymentConfig } from "./config/runtime";

const algorithm = "aes-256-cbc";
const ivLength = 16;

const key = createHash("sha256")
	.update(deploymentConfig.encryptionKey)
	.digest();

export const encryptText = (text: string): string => {
	const compressed = brotliCompressSync(text);
	const iv = randomBytes(ivLength);
	const cipher = createCipheriv(algorithm, key, iv);
	const encrypted = Buffer.concat([
		iv,
		cipher.update(compressed),
		cipher.final(),
	]);
	return encrypted.toString("base64");
};

export const decryptText = (encryptedBase64: string): string => {
	const encrypted = Buffer.from(encryptedBase64, "base64");
	const iv = encrypted.subarray(0, ivLength);
	const decipher = createDecipheriv(algorithm, key, iv);
	const decrypted = Buffer.concat([
		decipher.update(encrypted.subarray(ivLength)),
		decipher.final(),
	]);
	return brotliDecompressSync(decrypted).toString();
};
