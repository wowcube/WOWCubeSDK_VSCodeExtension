"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulatorMetricsEnabled = simulatorMetricsEnabled;
exports.setSimulatorMetrics = setSimulatorMetrics;
const metricsVariable = 'WOWCUBE_SIM_METRICS';
function simulatorMetricsEnabled(project) {
    return project.simulatorDebug?.macos?.env?.[metricsVariable] === '1' &&
        project.simulatorDebug?.windows?.environment?.some((entry) => entry.name === metricsVariable && entry.value === '1') === true;
}
function setSimulatorMetrics(project, enabled) {
    const value = enabled ? '1' : '0';
    const settings = project.simulatorDebug ?? {};
    const environment = (settings.windows?.environment ?? []).map((entry) => entry.name === metricsVariable ? { ...entry, value } : entry);
    if (!environment.some((entry) => entry.name === metricsVariable)) {
        environment.push({ name: metricsVariable, value });
    }
    return { ...project, simulatorDebug: {
            ...settings,
            macos: { ...settings.macos, env: { ...settings.macos?.env, [metricsVariable]: value } },
            windows: { ...settings.windows, environment }
        } };
}
//# sourceMappingURL=SimulatorMetrics.js.map