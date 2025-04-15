// add flags.ts
import { statsigAdapter, type StatsigUser } from "@flags-sdk/statsig";
import { flag, dedupe } from "flags/next";
import type { Identify } from "flags";

export const identify = dedupe((async () => ({
    customIDs: { userID: Math.random().toString(36).slice(2) },
    // add any additional user properties you collect here
})) satisfies Identify<StatsigUser>);

export const createFeatureGate = (key: string) => flag<boolean, StatsigUser>({
    key,
    adapter: statsigAdapter.featureGate((gate) => gate.value, { exposureLogging: true }),
    identify,
    decide() {
        return Math.random() > 0.1;
    },
});