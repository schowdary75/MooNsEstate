import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  Icon,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Text,
  Badge,
  Textarea,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useColorModeValue,
  HStack,
  VStack,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import { getApi, postApi, putApi, deleteApi } from 'services/api';
import { toast } from 'react-toastify';
import {
  MdPhone,
  MdLocationOn,
  MdEmail,
  MdFormatQuote,
  MdCalendarToday,
  MdChat,
  MdCheckCircle,
  MdCancel,
  MdSchedule,
  MdAdd,
  MdAutoAwesome,
  MdSearch,
  MdFilterList,
  MdDelete,
} from 'react-icons/md';
import {
  FaPhoneAlt,
  FaMapMarkerAlt,
  FaEnvelope,
  FaQuoteRight,
  FaCalendarAlt,
  FaWhatsapp,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaPlus,
  FaRobot,
  FaTrash,
  FaCommentDots
} from 'react-icons/fa';

export default function LeadFollowupIndex() {
  const [followups, setFollowups] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modals state
  const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();
  const { isOpen: isCompleteOpen, onOpen: onCompleteOpen, onClose: onCompleteClose } = useDisclosure();
  const { isOpen: isAiOpen, onOpen: onAiOpen, onClose: onAiClose } = useDisclosure();

  // Form states
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [outcomeText, setOutcomeText] = useState('');
  const [newLeadStatus, setNewLeadStatus] = useState('');

  // Add Follow-up Form state
  const [newLeadId, setNewLeadId] = useState('');
  const [newType, setNewType] = useState('call');
  const [newDate, setNewDate] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newNotes, setNewNotes] = useState('');

  // AI Script Modal state
  const [aiScriptText, setAiScriptText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const cardBg = useColorModeValue('white', 'navy.800');
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const subTextColor = useColorModeValue('gray.500', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');

  useEffect(() => {
    fetchFollowups();
    fetchLeads();
  }, []);

  const fetchFollowups = async () => {
    setIsLoading(true);
    try {
      const res = await getApi('api/lead-followup/');
      if (res?.data) {
        setFollowups(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Error fetching followups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await getApi('api/lead/');
      if (res?.data) {
        setLeads(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const now = new Date();
    let pending = 0;
    let overdue = 0;
    let today = 0;
    let completed = 0;

    followups.forEach((item) => {
      const fDate = item.followUpDate ? new Date(item.followUpDate) : null;
      if (item.status === 'completed') {
        completed++;
      } else if (item.status === 'cancelled') {
        // skipped
      } else {
        pending++;
        if (fDate && fDate < now && item.status !== 'completed') {
          overdue++;
        }
        if (
          fDate &&
          fDate.getFullYear() === now.getFullYear() &&
          fDate.getMonth() === now.getMonth() &&
          fDate.getDate() === now.getDate()
        ) {
          today++;
        }
      }
    });

    return { pending, overdue, today, completed };
  }, [followups]);

  // Filtering
  const filteredItems = useMemo(() => {
    const now = new Date();
    return followups.filter((item) => {
      // Status filter
      if (statusFilter === 'pending' && item.status !== 'pending' && item.status !== 'overdue') return false;
      if (statusFilter === 'completed' && item.status !== 'completed') return false;
      if (statusFilter === 'overdue') {
        const fDate = item.followUpDate ? new Date(item.followUpDate) : null;
        if (item.status === 'completed' || item.status === 'cancelled' || !fDate || fDate >= now) return false;
      }
      if (statusFilter === 'today') {
        const fDate = item.followUpDate ? new Date(item.followUpDate) : null;
        if (
          !fDate ||
          fDate.getFullYear() !== now.getFullYear() ||
          fDate.getMonth() !== now.getMonth() ||
          fDate.getDate() !== now.getDate()
        ) return false;
      }

      // Type filter
      if (typeFilter !== 'all' && item.followUpType !== typeFilter) return false;

      // Priority filter
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const leadName = item.leadId?.leadName || '';
        const notes = item.notes || '';
        const outcome = item.outcome || '';
        if (!leadName.toLowerCase().includes(q) && !notes.toLowerCase().includes(q) && !outcome.toLowerCase().includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [followups, statusFilter, typeFilter, priorityFilter, searchQuery]);

  // Actions
  const handleScheduleSubmit = async () => {
    if (!newLeadId || !newDate) {
      toast.error('Please select a lead and scheduled date/time');
      return;
    }
    try {
      const payload = {
        leadId: newLeadId,
        followUpType: newType,
        followUpDate: newDate,
        priority: newPriority,
        notes: newNotes,
        status: 'pending'
      };
      const res = await postApi('api/lead-followup/add', payload);
      if (res?.status === 200 || res?.data) {
        toast.success('Follow-up scheduled successfully!');
        onAddClose();
        setNewLeadId('');
        setNewDate('');
        setNewNotes('');
        fetchFollowups();
      } else {
        toast.error('Failed to schedule follow-up');
      }
    } catch (err) {
      toast.error('Error scheduling follow-up');
    }
  };

  const handleOpenComplete = (item: any) => {
    setSelectedItem(item);
    setOutcomeText('');
    setNewLeadStatus(item.leadId?.leadStatus || '');
    onCompleteOpen();
  };

  const handleCompleteSubmit = async () => {
    if (!selectedItem) return;
    try {
      const payload = {
        outcome: outcomeText,
        leadStatus: newLeadStatus || undefined
      };
      const res = await putApi(`api/lead-followup/complete/${selectedItem._id}`, payload);
      if (res?.status === 200 || res?.data) {
        toast.success('Follow-up marked as completed!');
        onCompleteClose();
        fetchFollowups();
      } else {
        toast.error('Failed to complete follow-up');
      }
    } catch (err) {
      toast.error('Error completing follow-up');
    }
  };

  const handleCancelSubmit = async (item: any) => {
    if (!window.confirm('Are you sure you want to cancel this follow-up?')) return;
    try {
      const res = await putApi(`api/lead-followup/cancel/${item._id}`, {});
      if (res?.status === 200 || res?.data) {
        toast.success('Follow-up cancelled');
        fetchFollowups();
      }
    } catch (err) {
      toast.error('Error cancelling follow-up');
    }
  };

  const handleDeleteSubmit = async (item: any) => {
    if (!window.confirm('Delete this follow-up record permanently?')) return;
    try {
      const res = await deleteApi('api/lead-followup/delete/', item._id);
      if (res?.status === 200 || res?.data) {
        toast.success('Follow-up deleted');
        fetchFollowups();
      }
    } catch (err) {
      toast.error('Error deleting follow-up');
    }
  };

  const handleGenerateAiScript = async (item: any) => {
    setSelectedItem(item);
    setIsAiLoading(true);
    onAiOpen();
    try {
      const payload = {
        leadName: item.leadId?.leadName || 'Client',
        followupType: item.followUpType,
        notes: item.notes,
        propertyInterest: item.leadId?.associatedListing?.title || 'Real Estate Property'
      };
      const res = await postApi('api/lead-followup/ai-script', payload);
      if (res?.data?.script) {
        setAiScriptText(res.data.script);
      } else {
        setAiScriptText('Could not generate script.');
      }
    } catch (err) {
      setAiScriptText('Failed to generate script.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return FaPhoneAlt;
      case 'site_visit': return FaMapMarkerAlt;
      case 'whatsapp': return FaWhatsapp;
      case 'email': return FaEnvelope;
      case 'quote': return FaQuoteRight;
      case 'meeting': return FaCalendarAlt;
      default: return FaCommentDots;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'blue';
      default: return 'gray';
    }
  };

  return (
    <Box pt={{ base: "130px", md: "80px", xl: "80px" }}>
      {/* Header Bar */}
      <Flex justify="space-between" align="center" mb="20px" flexWrap="wrap" gap="10px">
        <Box>
          <Heading size="lg" color={textColor}>
            Lead Follow-Ups Board
          </Heading>
          <Text color={subTextColor} fontSize="sm">
            Schedule, track, and close real estate lead communications
          </Text>
        </Box>

        <HStack spacing="10px">
          <Button
            leftIcon={<FaRobot />}
            colorScheme="teal"
            variant="outline"
            onClick={() => handleGenerateAiScript(followups[0] || {})}
            isDisabled={followups.length === 0}
          >
            AI Script Generator
          </Button>
          <Button
            leftIcon={<FaPlus />}
            colorScheme="brand"
            bg="brand.500"
            color="white"
            _hover={{ bg: "brand.600" }}
            onClick={onAddOpen}
          >
            Schedule Follow-Up
          </Button>
        </HStack>
      </Flex>

      {/* KPI Cards */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing="20px" mb="20px">
        <Card p="20px" bg={cardBg}>
          <Flex align="center">
            <Box p="12px" bg="blue.50" borderRadius="12px" color="blue.500" mr="15px">
              <Icon as={FaClock} w="24px" h="24px" />
            </Box>
            <Box>
              <Text color={subTextColor} fontSize="xs" fontWeight="bold">
                PENDING FOLLOW-UPS
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color={textColor}>
                {stats.pending}
              </Text>
            </Box>
          </Flex>
        </Card>

        <Card p="20px" bg={cardBg}>
          <Flex align="center">
            <Box p="12px" bg="red.50" borderRadius="12px" color="red.500" mr="15px">
              <Icon as={FaClock} w="24px" h="24px" />
            </Box>
            <Box>
              <Text color={subTextColor} fontSize="xs" fontWeight="bold">
                OVERDUE
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="red.500">
                {stats.overdue}
              </Text>
            </Box>
          </Flex>
        </Card>

        <Card p="20px" bg={cardBg}>
          <Flex align="center">
            <Box p="12px" bg="purple.50" borderRadius="12px" color="purple.500" mr="15px">
              <Icon as={FaCalendarAlt} w="24px" h="24px" />
            </Box>
            <Box>
              <Text color={subTextColor} fontSize="xs" fontWeight="bold">
                SCHEDULED TODAY
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color={textColor}>
                {stats.today}
              </Text>
            </Box>
          </Flex>
        </Card>

        <Card p="20px" bg={cardBg}>
          <Flex align="center">
            <Box p="12px" bg="green.50" borderRadius="12px" color="green.500" mr="15px">
              <Icon as={FaCheckCircle} w="24px" h="24px" />
            </Box>
            <Box>
              <Text color={subTextColor} fontSize="xs" fontWeight="bold">
                COMPLETED
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="green.500">
                {stats.completed}
              </Text>
            </Box>
          </Flex>
        </Card>
      </SimpleGrid>

      {/* Filter Controls Bar */}
      <Card p="15px" bg={cardBg} mb="20px">
        <Flex gap="15px" flexWrap="wrap" align="center">
          <Box flex="1" minW="220px">
            <Input
              placeholder="Search lead name or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="sm"
              borderRadius="8px"
            />
          </Box>

          <Box minW="150px">
            <Select
              size="sm"
              borderRadius="8px"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="today">Scheduled Today</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
            </Select>
          </Box>

          <Box minW="150px">
            <Select
              size="sm"
              borderRadius="8px"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="call">Call</option>
              <option value="site_visit">Site Visit</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="quote">Quote</option>
            </Select>
          </Box>

          <Box minW="130px">
            <Select
              size="sm"
              borderRadius="8px"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </Box>
        </Flex>
      </Card>

      {/* Follow-up Cards Grid */}
      {isLoading ? (
        <Flex justify="center" p="50px">
          <Spinner size="xl" color="brand.500" />
        </Flex>
      ) : filteredItems.length === 0 ? (
        <Card p="40px" textAlign="center" bg={cardBg}>
          <Text color={subTextColor} fontSize="lg">
            No follow-ups found matching your filters.
          </Text>
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing="20px">
          {filteredItems.map((item) => {
            const TypeIconComp = getTypeIcon(item.followUpType);
            const isOverdue = item.status === 'overdue' || (item.status === 'pending' && item.followUpDate && new Date(item.followUpDate) < new Date());
            const isCompleted = item.status === 'completed';

            return (
              <Card
                key={item._id}
                p="20px"
                bg={cardBg}
                borderLeft="4px solid"
                borderLeftColor={
                  isCompleted
                    ? 'green.400'
                    : isOverdue
                    ? 'red.500'
                    : `${getPriorityColor(item.priority)}.400`
                }
                shadow="sm"
                position="relative"
              >
                <Flex justify="space-between" align="flex-start" mb="10px">
                  <HStack spacing="10px">
                    <Box
                      p="8px"
                      borderRadius="50%"
                      bg={isCompleted ? 'green.50' : isOverdue ? 'red.50' : 'blue.50'}
                      color={isCompleted ? 'green.500' : isOverdue ? 'red.500' : 'blue.500'}
                    >
                      <Icon as={TypeIconComp} w="16px" h="16px" />
                    </Box>
                    <Box>
                      <Text fontWeight="bold" fontSize="md" color={textColor}>
                        {item.leadId?.leadName || 'Unassigned Lead'}
                      </Text>
                      <Text fontSize="xs" color={subTextColor}>
                        {item.leadId?.leadPhoneNumber || item.leadId?.leadEmail || 'No contact details'}
                      </Text>
                    </Box>
                  </HStack>

                  <Badge
                    colorScheme={
                      isCompleted
                        ? 'green'
                        : isOverdue
                        ? 'red'
                        : getPriorityColor(item.priority)
                    }
                    fontSize="xs"
                    borderRadius="6px"
                    px="8px"
                    py="2px"
                  >
                    {isCompleted ? 'COMPLETED' : isOverdue ? 'OVERDUE' : item.priority?.toUpperCase()}
                  </Badge>
                </Flex>

                <Box bg={useColorModeValue('gray.50', 'navy.900')} p="10px" borderRadius="8px" mb="12px">
                  <Text fontSize="xs" fontWeight="semibold" color={subTextColor} mb="4px">
                    SCHEDULED TIME
                  </Text>
                  <Text fontSize="sm" fontWeight="bold" color={textColor}>
                    {item.followUpDate ? new Date(item.followUpDate).toLocaleString() : 'Not set'}
                  </Text>
                </Box>

                {item.notes && (
                  <Box mb="12px">
                    <Text fontSize="xs" color={subTextColor} fontWeight="bold">
                      OBJECTIVE / NOTES:
                    </Text>
                    <Text fontSize="xs" color={textColor} noOfLines={3}>
                      {item.notes}
                    </Text>
                  </Box>
                )}

                {item.outcome && (
                  <Box mb="12px" p="8px" bg="green.50" borderRadius="6px" borderLeft="3px solid" borderLeftColor="green.400">
                    <Text fontSize="xs" fontWeight="bold" color="green.700">
                      OUTCOME:
                    </Text>
                    <Text fontSize="xs" color="green.800">
                      {item.outcome}
                    </Text>
                  </Box>
                )}

                {/* Card Footer Actions */}
                <Flex justify="space-between" align="center" pt="10px" borderTop="1px solid" borderColor={borderColor}>
                  <HStack spacing="6px">
                    <Tooltip label="AI Talking Track">
                      <IconButton
                        aria-label="AI Script"
                        icon={<FaRobot />}
                        size="xs"
                        colorScheme="teal"
                        variant="ghost"
                        onClick={() => handleGenerateAiScript(item)}
                      />
                    </Tooltip>
                    {item.leadId?.leadPhoneNumber && (
                      <Tooltip label="WhatsApp Lead">
                        <IconButton
                          aria-label="WhatsApp"
                          icon={<FaWhatsapp />}
                          size="xs"
                          colorScheme="whatsapp"
                          variant="ghost"
                          onClick={() => window.open(`https://wa.me/${item.leadId.leadPhoneNumber.replace(/[^0-9]/g, '')}`, '_blank')}
                        />
                      </Tooltip>
                    )}
                  </HStack>

                  <HStack spacing="8px">
                    {!isCompleted && item.status !== 'cancelled' && (
                      <>
                        <Button
                          size="xs"
                          colorScheme="green"
                          leftIcon={<FaCheckCircle />}
                          onClick={() => handleOpenComplete(item)}
                        >
                          Complete
                        </Button>
                        <IconButton
                          aria-label="Cancel"
                          icon={<FaTimesCircle />}
                          size="xs"
                          colorScheme="orange"
                          variant="ghost"
                          onClick={() => handleCancelSubmit(item)}
                        />
                      </>
                    )}
                    <IconButton
                      aria-label="Delete"
                      icon={<FaTrash />}
                      size="xs"
                      colorScheme="red"
                      variant="ghost"
                      onClick={() => handleDeleteSubmit(item)}
                    />
                  </HStack>
                </Flex>
              </Card>
            );
          })}
        </SimpleGrid>
      )}

      {/* Schedule Follow-Up Modal */}
      <Modal isOpen={isAddOpen} onClose={onAddClose} size="md">
        <ModalOverlay />
        <ModalContent bg={cardBg}>
          <ModalHeader color={textColor}>Schedule Lead Follow-Up</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="15px">
              <Box w="100%">
                <Text fontSize="sm" fontWeight="bold" mb="5px" color={textColor}>
                  Select Lead *
                </Text>
                <Select
                  placeholder="Choose lead..."
                  value={newLeadId}
                  onChange={(e) => setNewLeadId(e.target.value)}
                >
                  {leads.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.leadName} ({l.leadPhoneNumber || l.leadEmail || 'No Contact'})
                    </option>
                  ))}
                </Select>
              </Box>

              <Grid templateColumns="repeat(2, 1fr)" gap="10px" w="100%">
                <Box>
                  <Text fontSize="sm" fontWeight="bold" mb="5px" color={textColor}>
                    Follow-Up Type
                  </Text>
                  <Select value={newType} onChange={(e) => setNewType(e.target.value)}>
                    <option value="call">Phone Call</option>
                    <option value="site_visit">Site Visit</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="meeting">Meeting</option>
                    <option value="quote">Send Quote</option>
                    <option value="other">Other</option>
                  </Select>
                </Box>

                <Box>
                  <Text fontSize="sm" fontWeight="bold" mb="5px" color={textColor}>
                    Priority
                  </Text>
                  <Select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </Select>
                </Box>
              </Grid>

              <Box w="100%">
                <Text fontSize="sm" fontWeight="bold" mb="5px" color={textColor}>
                  Date & Time *
                </Text>
                <Input
                  type="datetime-local"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </Box>

              <Box w="100%">
                <Text fontSize="sm" fontWeight="bold" mb="5px" color={textColor}>
                  Objective / Notes
                </Text>
                <Textarea
                  placeholder="E.g., Walkthrough 3BHK pricing, check financing status..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={3}
                />
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onAddClose}>
              Cancel
            </Button>
            <Button colorScheme="brand" bg="brand.500" color="white" onClick={handleScheduleSubmit}>
              Schedule
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Complete Follow-Up Modal */}
      <Modal isOpen={isCompleteOpen} onClose={onCompleteClose} size="md">
        <ModalOverlay />
        <ModalContent bg={cardBg}>
          <ModalHeader color={textColor}>Mark Follow-Up Complete</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="15px">
              <Box w="100%">
                <Text fontSize="sm" fontWeight="bold" mb="5px" color={textColor}>
                  Outcome / Summary Notes *
                </Text>
                <Textarea
                  placeholder="E.g., Client interested in tower B, scheduled site visit for Saturday."
                  value={outcomeText}
                  onChange={(e) => setOutcomeText(e.target.value)}
                  rows={4}
                />
              </Box>

              <Box w="100%">
                <Text fontSize="sm" fontWeight="bold" mb="5px" color={textColor}>
                  Update Lead Status (Optional)
                </Text>
                <Select
                  value={newLeadStatus}
                  onChange={(e) => setNewLeadStatus(e.target.value)}
                >
                  <option value="">Keep Current Status</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="closed">Closed / Converted</option>
                  <option value="lost">Lost</option>
                </Select>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCompleteClose}>
              Cancel
            </Button>
            <Button colorScheme="green" onClick={handleCompleteSubmit}>
              Save Outcome & Complete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* AI Script Generator Modal */}
      <Modal isOpen={isAiOpen} onClose={onAiClose} size="lg">
        <ModalOverlay />
        <ModalContent bg={cardBg}>
          <ModalHeader color={textColor}>
            <HStack>
              <Icon as={FaRobot} color="teal.400" />
              <Text>AI Real Estate Script Assistant</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {isAiLoading ? (
              <Flex justify="center" p="40px">
                <Spinner size="lg" color="teal.400" />
              </Flex>
            ) : (
              <Box bg={useColorModeValue('gray.50', 'navy.900')} p="15px" borderRadius="8px">
                <Text fontSize="sm" fontFamily="monospace" whiteSpace="pre-wrap" color={textColor}>
                  {aiScriptText}
                </Text>
              </Box>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="teal" onClick={onAiClose}>
              Done
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
