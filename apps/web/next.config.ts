import type { NextConfig } from "next";

const config: NextConfig = {
	transpilePackages: ["@hdata/domain", "@hdata/api-client"],
};

export default config;
