import { call } from "@decky/api";
import { useEffect, useState } from "react";

export default function LogView() {
    const [logContent, setLogContent] = useState("");

    const fetchLog = async () =>
    {
        setLogContent(await call<[], string>("get_rclone_log"));
    }

    useEffect(() =>
    {
        fetchLog()
    }, [])

    return (
        <pre
        style = {{
            whiteSpace: "pre-wrap",
            wordWrap: "break-word"
        }}>
        {logContent}
        </pre>
    )
}