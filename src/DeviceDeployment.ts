import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { Configuration } from './Configuration';
import { Output } from './Output';
import { Providers } from './Providers';

export class DeviceDeployment
{
	public static async upload(mac:string, source:string, application?:{guid1:string; guid2:string}):Promise<void>
	{
		if(Configuration.isDeviceBusy(mac)) { throw new Error('The selected WOWCube device is busy. Wait for its current operation to finish.'); }
		const channel = Output.channel();
		Configuration.setDeviceBusy(mac, true);
		try
		{
			Providers.btdevices?.showWait(true);
			const stat = await fs.promises.stat(source).catch(() => undefined);
			if(!stat?.isFile() || stat.size === 0) { throw new Error('Application package is missing or empty: '+source); }
			const args = ['up', '-p', source, '-a', mac];

			// Legacy CUB uploads support logging; OCT uploads do not accept these flags.
			const logging = +Configuration.getLoggingMode() - 1;
			if(path.extname(source).toLowerCase() === '.cub' && logging >= 0) { args.push('-l', '-cid', String(logging)); }
			channel.show(true);
			const device = Configuration.getCurrentDevice();
			const destination = device?.mac === mac && device.name ? device.name+' ('+mac+')' : mac;
			channel.appendLine('Uploading '+path.basename(source)+' to '+destination+'...');
			await DeviceDeployment.command(args, 'upload');
			channel.appendLine('Upload complete.');
			if(application)
			{
				channel.appendLine('Refreshing installed applications...');
				const catalog = await DeviceDeployment.command(['ci', '-f', '-c', '-al', '-a', mac], 'application list refresh');
				const guid1 = application.guid1.toLowerCase().padStart(16, '0');
				const guid2 = application.guid2.toLowerCase().padStart(16, '0');
				const app = Array.from(catalog.matchAll(/^(.+) \(([^\r\n]*)\) guid1=([0-9a-fA-F]{16}) guid2=([0-9a-fA-F]{16})\r?$/gm))
					.find(entry => entry[3].toLowerCase() === guid1 && entry[4].toLowerCase() === guid2);
				if(!app) { throw new Error('Upload completed, but the application is not in the device application list. Open WOWCube Device Details and refresh its application list.'); }
				channel.appendLine('Waiting one second before launch...');
				await new Promise<void>(resolve => setTimeout(resolve, 1000));
				channel.appendLine('Starting '+app[1]+'...');
				await DeviceDeployment.command(['ra', '-g1', app[3], '-g2', app[4], '-a', mac], 'launch');
				channel.appendLine('Launch command sent.');
			}
		}
		finally
		{
			Configuration.setDeviceBusy(mac, false);
			Providers.btdevices?.showWait(false);
		}
	}

	private static async command(args:string[], operation:string):Promise<string>
	{
		const channel = Output.channel();
		return new Promise<string>((resolve, reject) =>
		{
			let failed = false;
			let pending = '';
			let stdout = '';
			const proc = cp.spawn(path.join(Configuration.getUtilsPath(), Configuration.getLoader()), args, {env:process.env, windowsHide:true});
			const output = (data:Buffer) =>
			{
				const text = data.toString();
				channel.append(text);
				// Some loader versions report an error in their output despite returning zero.
				pending = (pending + text).slice(-8192);
				if(/\berror:/i.test(pending)) { failed = true; }
			};
			proc.stdout?.on('data', (data:Buffer) => { stdout += data.toString(); output(data); });
			proc.stderr?.on('data', output);
			proc.once('error', reject);
			proc.once('close', code => code === 0 && !failed ? resolve(stdout) : reject(new Error('Device '+operation+' failed'+(code === null ? '.' : ' (exit code '+code+').')+' See Output for details.')));
		});
	}

	public static async uploadAndRun(source:string, application:{guid1:string; guid2:string}):Promise<void>
	{
		const device = Configuration.getCurrentDevice();
		if(!device?.mac) { throw new Error('No WOWCube device selected. Select a device in WOWCube Devices, then build again.'); }
		if(!application || ![application.guid1, application.guid2].every(value => typeof value === 'string' && /^[0-9a-fA-F]{1,16}$/.test(value)))
		{
			throw new Error('Cannot launch the application: metadata.application.guid1 and guid2 must be hexadecimal strings of 1–16 digits in wowcubeapp-build.json.');
		}
		await DeviceDeployment.upload(device.mac, source, application);
	}
}
