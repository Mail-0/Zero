"use client"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle
} from "@/components/ui/navigation-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MoveRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { CustomTabGlow, tabs } from "./home"

export default function Home() {
  const tabRefs = useRef<HTMLButtonElement[]>([])
  const [glowStyle, setGlowStyle] = useState({ left: 0, width: 0 })

  const handleTabChange = useCallback((value: string) => {
    const index = tabs.findIndex((tab) => tab.value === value)
    const tab = tabRefs.current[index]
    if (tab) {
      const rect = tab.getBoundingClientRect()
      const listRect = tab.parentElement?.getBoundingClientRect()
      const offsetLeft = listRect ? rect.left - listRect.left : 0

      const newWidth = rect.width * 0.9
      const newLeft = offsetLeft + (rect.width - newWidth) / 2

      setGlowStyle({ left: newLeft, width: newWidth })
    }
  }, [])

  useEffect(() => {
    handleTabChange(tabs[0].value)
  }, [handleTabChange])

  return (
    <main className="relative flex flex-1 flex-col">
      <header className="fixed z-50 flex w-full items-center justify-center pt-6">
        <nav className="flex w-full max-w-2xl items-center justify-between gap-2 rounded-xl border bg-popover p-2">
          <div className="flex items-center gap-6">
            <div className="size-10 rounded-md bg-white" />
            <NavigationMenu>
              <NavigationMenuList className="gap-1">
                <NavigationMenuItem>
                  <Link
                    href="/#"
                    passHref
                  >
                    <NavigationMenuLink
                      className={navigationMenuTriggerStyle()}
                    >
                      Product
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>Solutions</NavigationMenuTrigger>
                  {/* <NavigationMenuContent>
              <NavigationMenuLink>Link</NavigationMenuLink>
            </NavigationMenuContent> */}
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>Resource</NavigationMenuTrigger>
                  {/* <NavigationMenuContent>
              <NavigationMenuLink>Link</NavigationMenuLink>
            </NavigationMenuContent> */}
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="h-10"
            >
              Sign in
            </Button>
            <Button className="h-10 font-medium">Get started</Button>
          </div>
        </nav>
      </header>
      <section className="mt-40 flex flex-col items-center">
        <div className="mb-6 inline-flex items-center rounded-full border bg-[#2a2a2a] px-4 py-1.5 pr-1.5">
          <span>See what's new from O.email</span>
          <Link
            href="/#"
            className="ml-2 flex items-center gap-1 rounded-full bg-gradient-to-b from-neutral-600 to-neutral-700 px-3 py-1 text-foreground text-sm"
          >
            <span>Learn More</span>
            <MoveRight className="!size-4" />
          </Link>
        </div>
        <h1 className="mb-6 text-center text-6xl">
          Open source gmail
          <br />
          alternative
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-center text-gray-400 text-lg">
          Experience email the way you want with O – the first open source
          <br />
          email app that puts your privacy and safety first.
        </p>
        <Button className="bg-white px-6 py-5 text-black hover:bg-gray-200">
          Get Started
        </Button>
      </section>
      <section className="mt-10 flex flex-col">
        <div className="flex justify-center">
          <Tabs
            defaultValue="smart-categorization"
            onValueChange={handleTabChange}
            className="flex items-center"
          >
            <div className="tabs-container relative flex w-full justify-center overflow-hidden">
              <TabsList className="relative h-fit rounded-none bg-transparent">
                {/* Glow */}
                <CustomTabGlow glowStyle={glowStyle} />

                {/* Tab Triggers */}
                {tabs.map((tab, index) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="!bg-transparent !shadow-none relative h-12 w-52 rounded-none"
                    ref={(el) => {
                      if (el) tabRefs.current[index] = el
                    }}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="flex justify-center">
              <div className="container xl:max-w-7xl">
                {tabs.map((tab) => (
                  <TabsContent
                    key={tab.value}
                    value={tab.value}
                  >
                    <Image
                      src="/email-preview.png"
                      alt="Zero Email Preview"
                      width={1920}
                      height={1080}
                      className=""
                    />
                  </TabsContent>
                ))}
              </div>
            </div>
          </Tabs>
        </div>
      </section>
    </main>
  )
}