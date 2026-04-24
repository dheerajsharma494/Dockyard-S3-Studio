export async function POST(req) {
  try {
    const {
      tool = "awscli",
      operation = "list",
      bucket = "my-bucket",
      key = "path/file.txt",
      destination = "./downloaded-file",
    } = await req.json();

    if (tool === "awscli") {
      const commands = {
        list: `aws s3 ls s3://${bucket} --recursive`,
        cp: `aws s3 cp s3://${bucket}/${key} ./${key.split("/").pop()}`,
        sync: `aws s3 sync s3://${bucket} ./local-dir`,
        rm: `aws s3 rm s3://${bucket}/${key}`,
        mb: `aws s3 mb s3://${bucket}`,
        rb: `aws s3 rb s3://${bucket} --force`,
        // legacy aliases
        upload: `aws s3 cp ./local-file s3://${bucket}/${key}`,
        download: `aws s3 cp s3://${bucket}/${key} ${destination}`,
        move: `aws s3 mv s3://${bucket}/${key} s3://${bucket}/new/path/${key.split("/").pop()}`,
        delete: `aws s3 rm s3://${bucket}/${key}`,
      };
      const command = commands[operation];
      if (!command) {
        return Response.json(
          { error: `Unsupported operation: ${operation}` },
          { status: 400 },
        );
      }
      return Response.json({ success: true, command });
    }

    if (tool === "boto3") {
      const snippets = {
        list: `import boto3\n\ns3 = boto3.client("s3")\nprint(s3.list_objects_v2(Bucket="${bucket}").get("Contents", []))`,
        upload: `import boto3\n\ns3 = boto3.client("s3")\ns3.upload_file("./local-file", "${bucket}", "${key}")`,
        download: `import boto3\n\ns3 = boto3.client("s3")\ns3.download_file("${bucket}", "${key}", "${destination}")`,
        delete: `import boto3\n\ns3 = boto3.client("s3")\ns3.delete_object(Bucket="${bucket}", Key="${key}")`,
      };
      return Response.json({
        success: true,
        command: snippets[operation] || snippets.list,
      });
    }

    return Response.json({ error: "Unsupported tool" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to export CLI command" },
      { status: 500 },
    );
  }
}
