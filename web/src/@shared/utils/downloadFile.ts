type DownloadFileParams = {
  content: string;
  fileName: string;
  type: string;
};

export const downloadFile = ({
  content,
  fileName,
  type,
}: DownloadFileParams) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], {
    type,
  }));
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const videoStem = (video: string) => video.replace(/\.[^.]+$/, '');
