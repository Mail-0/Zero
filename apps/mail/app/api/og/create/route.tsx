import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  // Get URL parameters
  const { searchParams } = new URL(request.url);
  const toParam = searchParams.get('to') || 'someone';
  const subjectParam = searchParams.get('subject') || '';
  
  // Use the email directly
  const recipient = toParam;
  
  // Load fonts
  async function loadGoogleFont(font: string, weight: string) {
    const url = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&display=swap`;
    const css = await (await fetch(url)).text();
    const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);

    // Check if resource and the captured group exist
    if (resource?.[1]) {
      const response = await fetch(resource[1]);
      if (response.status === 200) {
        return await response.arrayBuffer();
      }
    }

    throw new Error('failed to load font data');
  }

  // Use a simple embedded SVG for the Zero logo instead of trying to load from file
  const logoSvg = `<svg width="191" height="191" viewBox="0 0 191 191" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M38.125 190.625V152.5H0V38.125H38.125V0H152.5V38.125H190.625V152.5H152.5V190.625H38.125ZM38.125 114.375H76.25V150.975H152.5V76.25H114.375V114.375H76.25V76.25H114.375V39.65H38.125V114.375Z" fill="white"/>
  </svg>`;
  
  const logoDataUrl = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

  const fontWeight400 = await loadGoogleFont('Geist', '400');
  const fontWeight600 = await loadGoogleFont('Geist', '600');

  return new ImageResponse(
    (
      <div tw="text-white bg-black w-full py-3 px-6 h-full flex items-center justify-center flex-col">
        <div tw="flex flex-col items-center justify-center">
          <div tw="flex mb-8 rounded-xl border-white p-4 items-center">
            <img src={logoDataUrl} width="72" height="72" alt="mail" />
          </div>
          <div
            tw="flex flex-col items-center justify-center text-5xl"
            style={{ fontFamily: 'bold' }}
          >
            <div tw="flex items-center">
              <span tw="text-[#fff]">Email</span>
              <span tw="text-[#A1A1A1] ml-3">{recipient}</span>
              <span tw="text-[#fff]">on Zero</span>
            </div>
           
          </div>

          <div tw="text-[36px] text-center text-neutral-400 mt-10" style={{ fontFamily: 'light' }}>
            {subjectParam 
              ? `Subject: ${subjectParam.length > 50 ? subjectParam.substring(0, 47) + '...' : subjectParam}`
              : 'Compose a new email'}
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, #fff  100%, #ffff  100%)',
            width: '20rem',
            height: '20rem',
            filter: 'blur(180px)',
            borderRadius: '50%',
            display: 'flex',
            position: 'absolute',
            bottom: '-100px',
            left: '-40px',
            opacity: '0.18',
          }}
        ></div>
        <div
          style={{
            background: 'linear-gradient(135deg, #fff  100%, #fff  100%)',
            width: '20rem',
            height: '20rem',
            filter: 'blur(180px)',
            borderRadius: '50%',
            display: 'flex',
            position: 'absolute',
            top: '33%',
            right: '-40px',
            opacity: '0.26',
          }}
        ></div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'light',
          data: fontWeight400,
          style: 'normal',
          weight: 400,
        },
        {
          name: 'bold',
          data: fontWeight600,
          style: 'normal',
          weight: 600,
        },
      ],
    },
  );
}