export async function deployQuartoDocument(
    title: string,
    quartoDocPath: string
): Promise<string> {
    let serverUrl = process.env.DEPLOY_CONNECT_SERVER_URL;
    let apiKey = process.env.DEPLOY_CONNECT_SERVER_API_KEY;

    // check for the existing app on connect server
    let rsconnectSearchCommand = await import("child_process").then(cp => cp.execSync(
        `rsconnect content search -s ${serverUrl} -k ${apiKey} --title-contains ${title}`
    ));
    let appId = JSON.parse(rsconnectSearchCommand.toString())[0]["id"];
    let guid = JSON.parse(rsconnectSearchCommand.toString())[0]["guid"];
    // Deploy the quarto document to Connect server
    let rsconnectDeployCommand = await import("child_process").then(cp => cp.execSync(
        `rsconnect deploy quarto ${quartoDocPath} -s ${serverUrl} -k ${apiKey} --app-id ${appId}`
    ));
    console.log(rsconnectDeployCommand.toString());
    const connectAppUrl = `${serverUrl}/__api__/v1/content/${guid}`;
    const payload = '{"access_type":"all"}';
    const headers = {
        Authorization: `Key ${apiKey}`,
        Accept: "application/json",
    };
    // Change the permissions to all users in order for tests to visit the quarto url on connect
    const response = await fetch(connectAppUrl, {
        method: "PATCH",
        headers: headers,
        body: payload,
    });

    if (response.status !== 200) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return `${serverUrl}/content/${guid}`;
}

export async function renderQuartoDocument(quartoDocPath: string): Promise<string> {
    let quartoRenderCommand = await import("child_process").then(cp => cp.execSync(
        `quarto render ${quartoDocPath}/*.qmd`
    ));

    // check in the quartoRenderCommand if "Output created:" is present
    if (quartoRenderCommand.toString().includes("Output created:")) {
        console.log("Output created");
    } else {
        console.log("Output not created");
    }
}
