import { addEventListener, call, removeEventListener } from "@decky/api";
import { playSectionClasses } from "@decky/ui";
import { useEffect, useState } from "react";
import { FaCloud, FaCloudDownloadAlt, FaCloudUploadAlt } from "react-icons/fa";
import { getSetting } from "./settings";

interface CustomCloudStatusProps {
    appId: number
}

export default function CustomCloudStatus({appId}: CustomCloudStatusProps)
{
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [rcloneStatus, setRcloneStatus] = useState<string>("idle");
  const [rcloneProgress, setRcloneProgress] = useState<number | undefined>(undefined);
  const [statusText, setStatusText] = useState<React.ReactNode>("Idle");
  const [StatusIcon, setStatusIcon] = useState(() => FaCloud)

  useEffect(() => {
    updateRcloneStatus();
    addEventListener("progress_event",updateProgress);
    
    Promise.all([getSetting(appId,"sync_config_before_game",false),getSetting(appId,"sync_save_before_game",false),getSetting(appId,"sync_config_after_game",false),getSetting(appId,"sync_save_after_game",false)]).then((settings) => {
      if(settings.some(setting => setting == true)) setIsVisible(true);

      const syncConfig = settings[0] || settings[2];
      const syncSave = settings[1] || settings[3];

      //TODO: run a passive sync check based on syncConfig and/or syncSave
    })

    return () => {
      updateRcloneStatus();
      removeEventListener("progress_event",updateProgress);
    }
  },[])

  function updateProgress(newProgress: number,_: number,_2: string,error: string)
  {
    updateRcloneStatus();
    setRcloneProgress(newProgress);

    if(newProgress == 100)
    {
      if(error) setRcloneStatus("sync_error");
      else setRcloneStatus("sync_complete");
    }
  }

  const updateRcloneStatus = async() =>
  {
      let newStatus = await call<[], string>("get_status");

      setRcloneStatus(newStatus)
  }

  useEffect(() => {
    if(rcloneStatus.startsWith("uploading"))
    {
      setStatusIcon(() => FaCloudUploadAlt);
      setStatusText((rcloneProgress != undefined) ? `Uploading (${Math.floor(rcloneProgress)}%)` : "Uploading");
    }
    else if(rcloneStatus.startsWith("downloading"))
    {
      setStatusIcon(() => FaCloudDownloadAlt);
      setStatusText((rcloneProgress != undefined) ? `Downloading (${Math.floor(rcloneProgress)}%)` : "Downloading");
    }
    else if(rcloneStatus == "sync_error")
    {
      setStatusIcon(() => FaCloud);
      setStatusText("Sync error");
    }
    else if(rcloneStatus == "sync_complete")
    {
      setStatusIcon(() => FaCloud);
      setStatusText("Up to date");
    }
  }, [rcloneStatus, rcloneProgress])

  if(isVisible == false) return null;

  return (
  <div className={playSectionClasses.CloudStatusRow}>
    <div className={playSectionClasses.GameStat}>
      <div className={playSectionClasses.GameStatIconForced}>
        <StatusIcon size="26px" />
        </div>
        <div className={playSectionClasses.GameStatRight}>
          <div className={playSectionClasses.PlayBarLabel}>CustomCloud Status</div>
          <div className={playSectionClasses.PlayBarDetailLabel}>{statusText}</div>
        </div>
    </div>
  </div>
  )
}