import { createCliRenderer } from '@opentui/core';
const fd = process.stderr.fd;
const write = (msg) => process.stderr.write(msg + '\n');

write('Before create');
const renderer = createCliRenderer({ exitOnCtrlC: false });
write('After create');
write('once: ' + typeof renderer.once);
write('setFrameCallback: ' + typeof renderer.setFrameCallback);
write('render: ' + typeof renderer.render);
write('destroy: ' + typeof renderer.destroy);
write('root: ' + (renderer.root ? 'object' : 'null'));

setTimeout(() => write('timeout'), 1000);
