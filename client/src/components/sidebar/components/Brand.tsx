import React from "react";
import { Flex, Heading, Image, useColorModeValue } from "@chakra-ui/react";
import { motion } from "framer-motion";

export interface SidebarBrandProps {
  setOpenSidebar?: (open: boolean) => void;
  openSidebar?: boolean;
  from?: boolean;
  largeLogo?: Array<{ logoLgImg?: string; logoSmImg?: string }>;
}

export const SidebarBrand: React.FC<SidebarBrandProps> = (props) => {
  const { setOpenSidebar, openSidebar, from, largeLogo } = props;
  const logoColor = useColorModeValue("navy.700", "white");

  return (
    <Flex
      align="center"
      direction="column"
      position="sticky"
      top="0"
      left="0"
      bg="#fff"
      py={2}
    >
      <Flex align="center">
        {largeLogo && (largeLogo[0]?.logoLgImg || largeLogo[0]?.logoSmImg) ? (
          <Image
            h="52px"
            w="100%"
            src={
              openSidebar === true
                ? largeLogo[0]?.logoLgImg
                : largeLogo[0]?.logoSmImg
            }
            alt="MooN Logo"
            cursor="pointer"
            onClick={() => !from && setOpenSidebar && setOpenSidebar(!openSidebar)}
            userSelect="none"
            my={2}
          />
        ) : (
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.2 }}
          >
            <Flex
              align="center"
              gap={2.5}
              my={2}
              cursor="pointer"
              onClick={() => !from && setOpenSidebar && setOpenSidebar(!openSidebar)}
              userSelect="none"
              px={3}
              py={1.5}
              borderRadius="xl"
              bg="whiteAlpha.800"
              boxShadow="0 4px 15px rgba(0,0,0,0.05)"
            >
              <Image src="/moon_logo.svg" h="38px" alt="MooN Logo" />
              {openSidebar === true && (
                <Flex direction="column">
                  <Heading size="md" fontWeight="bold" letterSpacing="tight" color={logoColor}>
                    MooNEstates
                  </Heading>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Real Estate CRM
                  </span>
                </Flex>
              )}
            </Flex>
          </motion.div>
        )}
      </Flex>
    </Flex>
  );
};

export default SidebarBrand;
