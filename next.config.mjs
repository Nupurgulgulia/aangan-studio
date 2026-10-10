/** @type {import('next').NextConfig} */
const nextConfig = {
  // context/*.md are read at runtime to build the scoring prompt
  outputFileTracingIncludes: { "/api/vaani/webhook": ["./context/**/*"] },
};
export default nextConfig;
