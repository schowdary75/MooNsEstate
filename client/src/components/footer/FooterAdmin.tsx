import React from "react";
import { Flex, Link, Text, useColorModeValue } from "@chakra-ui/react";
import { motion } from "framer-motion";

export const FooterAdmin: React.FC = () => {
  const textColor = useColorModeValue("blue.700", "white");
  
  return (
    <Flex
      zIndex={3}
      direction={{ base: "column", xl: "row" }}
      align={{ base: "center", xl: "start" }}
      justify="space-between"
      px="30px"
      pb="30px"
    >
      <Text color={textColor} textAlign={{ base: "center", xl: "start" }} mb="20px">
        &copy; {new Date().getFullYear()}
        <Text as="span" fontWeight="500" ms="4px">
          <motion.span whileHover={{ scale: 1.05 }} className="inline-block">
            <Link fontWeight="bold" color={textColor} href="#">
              MooNEstates.
            </Link>
          </motion.span>{" "}
          Need help or support? Contact{" "}
          <Link href="mailto:support@moonestates.com" fontWeight="500" color={textColor}>
            support@moonestates.com
          </Link>
        </Text>
      </Text>
    </Flex>
  );
};

export default FooterAdmin;
