import {
  LinkedinIcon,
  LinkedinShareButton,
  TwitterIcon,
  TwitterShareButton,
  WhatsappIcon,
  WhatsappShareButton,
} from 'next-share';

const EarlyPassShare = () => {
  
  const shareUrl = 'https://0.email';
  const shareTitle = `Just got my Early Access Pass from @zerodotemail.`;

  return (
    <div className='flex items-center gap-2'>
      <TwitterShareButton
        url={shareUrl}
        title={shareTitle}
        hashtags={['zerodotemail', '0email', 'mail0']}
      >
        <TwitterIcon size={32} round />
      </TwitterShareButton>
      <LinkedinShareButton
        url={shareUrl}
        title={shareTitle}
      >
        <LinkedinIcon size={32} round />
      </LinkedinShareButton>
      <WhatsappShareButton
        url={shareUrl}
        title={shareTitle}
      >
        <WhatsappIcon size={32} round />
      </WhatsappShareButton>
    </div>
  );
};

export default EarlyPassShare;