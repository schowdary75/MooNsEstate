import React from "react";
import { Flex, Link, Text, useColorModeValue } from "@chakra-ui/react";

export const FooterAuth: React.FC = () => {
  const textColor = useColorModeValue("blue.700", "white");
  
  return (
    <Flex
      zIndex="3"
      flexDirection={{
        base: "column",
        lg: "row",
      }}
      alignItems={{
        base: "center",
        xl: "start",
      }}
      justifyContent="space-between"
      px={{ base: "30px", md: "0px" }}
      pb="30px"
    >
      <Text
        color={textColor}
        textAlign={{
          base: "center",
          xl: "start",
        }}
        mb={{ base: "20px", lg: "0px" }}
      >
        {" "}
        &copy; {new Date().getFullYear()}
        <Text as="span" fontWeight="500" ms="4px">
          <Link
            fontWeight="500"
            color={textColor}
            target="_blank"
            href="#"
          >
            {" "}
            MooNEstates.
          </Link>{" "}
          Need help or support? Contact{" "}
          <Link
            href="mailto:support@moonestates.com"
            fontWeight="500"
            color={textColor}
            target="_blank"
          >
            support@moonestates.com
          </Link>
        </Text>
      </Text>
    </Flex>
  );
};

export default FooterAuth;
