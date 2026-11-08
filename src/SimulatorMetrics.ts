const metricsVariable = 'WOWCUBE_SIM_METRICS';

export function simulatorMetricsEnabled(project: any): boolean
{
    return project.simulatorDebug?.macos?.env?.[metricsVariable] === '1' &&
        project.simulatorDebug?.windows?.environment?.some(
            (entry: {name: string; value: string}) => entry.name === metricsVariable && entry.value === '1') === true;
}

export function setSimulatorMetrics(project: any, enabled: boolean): any
{
    const value = enabled ? '1' : '0';
    const settings = project.simulatorDebug ?? {};
    const environment = (settings.windows?.environment ?? []).map((entry: {name: string; value: string}) =>
        entry.name === metricsVariable ? {...entry, value} : entry);
    if (!environment.some((entry: {name: string}) => entry.name === metricsVariable))
    {
        environment.push({name: metricsVariable, value});
    }
    return {...project, simulatorDebug: {
        ...settings,
        macos: {...settings.macos, env: {...settings.macos?.env, [metricsVariable]: value}},
        windows: {...settings.windows, environment}
    }};
}
