# Traitlet configuration file for jupyter-notebook.

c.ServerProxy.servers = {
    'vscode': {
        'command': ['code-server', '--auth', 'none', '--disable-telemetry', '--port={port}', '.'],
        'timeout': 300,
        'launcher_entry': {
            'enabled': True,
            'icon_path': '.jupyter/vscode.svg',
            'title': 'VS Code',
        },
    },
}
